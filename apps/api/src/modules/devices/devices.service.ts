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
