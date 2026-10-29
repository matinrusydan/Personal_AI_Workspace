import { Injectable, BadRequestException } from '@nestjs/common';
import { prisma } from '@paw/database';
import { AuditService } from '../audit/audit.service';

export interface DesiredAlarmItem {
  occurrenceId: string;
  scheduledFor: string;
  title: string;
  version: number;
}

@Injectable()
export class DevicesService {
  constructor(private readonly auditService: AuditService) {}

  async registerDevice(
    ownerId: string,
    params: {
      platform: 'ios' | 'web' | 'desktop_windows';
      installId: string;
      deviceName?: string;
    },
    traceId?: string,
  ) {
    if (!params.installId || !params.platform) {
      throw new BadRequestException('installId and platform are required');
    }

    const device = await prisma.device.upsert({
      where: {
        ownerId_installId: {
          ownerId,
          installId: params.installId,
        },
      },
      create: {
        ownerId,
        platform: params.platform,
        installId: params.installId,
        deviceName: params.deviceName,
      },
      update: {
        lastSeenAt: new Date(),
        deviceName: params.deviceName ?? undefined,
      },
    });

    this.auditService.record({
      actorType: 'device',
      actorId: device.id,
      action: 'device.registered',
      traceId,
      metadata: { platform: device.platform, installId: device.installId },
    });

    return {
      data: {
        id: device.id,
        platform: device.platform,
        installId: device.installId,
        deviceName: device.deviceName,
        registeredAt: device.registeredAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
    };
  }

  async listDevices(ownerId: string) {
    const devices = await prisma.device.findMany({
      where: { ownerId },
      orderBy: { lastSeenAt: 'desc' },
    });

    return {
      data: devices.map((d) => ({
        id: d.id,
        platform: d.platform,
        installId: d.installId,
        deviceName: d.deviceName,
        registeredAt: d.registeredAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
    };
  }

  async reportAlarmStatus(
    ownerId: string,
    occurrenceId: string,
    dto: { platformAlarmId?: string; status: string; errorMessage?: string },
    traceId?: string,
  ) {
    const occurrence = await prisma.reminderOccurrence.findFirst({
      where: { id: occurrenceId, rule: { ownerId } },
    });

    if (!occurrence) {
      throw new BadRequestException(`Reminder occurrence ${occurrenceId} not found`);
    }

    const device = await prisma.device.findFirst({
      where: { ownerId },
    });

    if (device) {
      await prisma.deviceAlarm.upsert({
        where: {
          deviceId_occurrenceId: {
            deviceId: device.id,
            occurrenceId,
          },
        },
        create: {
          deviceId: device.id,
          occurrenceId,
          platformAlarmId: dto.platformAlarmId,
          status: dto.status,
          errorMessage: dto.errorMessage,
        },
        update: {
          platformAlarmId: dto.platformAlarmId,
          status: dto.status,
          errorMessage: dto.errorMessage,
        },
      });
    }

    this.auditService.record({
      actorType: 'device',
      actorId: device?.id || 'unknown',
      action: 'device.alarm.status_reported',
      target: occurrenceId,
      traceId,
      metadata: { status: dto.status, platformAlarmId: dto.platformAlarmId },
    });

    return { success: true };
  }

  async getDesiredAlarms(ownerId: string): Promise<{ data: DesiredAlarmItem[] }> {
    const occurrences = await prisma.reminderOccurrence.findMany({
      where: {
        status: { in: ['scheduled', 'snoozed'] },
        rule: { ownerId },
      },
      include: {
        rule: true,
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });

    return {
      data: occurrences.map((occ) => ({
        occurrenceId: occ.id,
        scheduledFor: occ.scheduledFor.toISOString(),
        title: `Reminder for ${occ.rule.sourceType}`,
        version: occ.attemptVersion,
      })),
    };
  }
}
