import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';

export interface DeviceEntity {
  id: string;
  ownerId: string;
  platform: 'ios' | 'web' | 'desktop_windows';
  installId: string;
  deviceName?: string;
  registeredAt: string;
  lastSeenAt: string;
}

export interface DesiredAlarmItem {
  occurrenceId: string;
  scheduledFor: string;
  title: string;
  version: number;
}

@Injectable()
export class DevicesService {
  private readonly devices = new Map<string, DeviceEntity>();

  constructor(private readonly auditService: AuditService) {}

  registerDevice(
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

    // Check existing device by (ownerId, installId)
    let existing: DeviceEntity | undefined;
    for (const dev of this.devices.values()) {
      if (dev.ownerId === ownerId && dev.installId === params.installId) {
        existing = dev;
        break;
      }
    }

    const now = new Date().toISOString();

    if (existing) {
      existing.lastSeenAt = now;
      if (params.deviceName) existing.deviceName = params.deviceName;
      this.devices.set(existing.id, existing);

      this.auditService.record({
        actorType: 'device',
        actorId: existing.id,
        action: 'device.updated',
        traceId,
        metadata: { platform: existing.platform, installId: existing.installId },
      });

      return {
        data: existing,
      };
    }

    const deviceId = randomUUID();
    const newDevice: DeviceEntity = {
      id: deviceId,
      ownerId,
      platform: params.platform,
      installId: params.installId,
      deviceName: params.deviceName,
      registeredAt: now,
      lastSeenAt: now,
    };

    this.devices.set(deviceId, newDevice);

    this.auditService.record({
      actorType: 'device',
      actorId: deviceId,
      action: 'device.registered',
      traceId,
      metadata: { platform: newDevice.platform, installId: newDevice.installId },
    });

    return {
      data: newDevice,
    };
  }

  getDesiredAlarms(_ownerId: string): { data: DesiredAlarmItem[] } {
    // Contract baseline endpoint: returns empty or scheduled alarm items delta for device sync
    return {
      data: [],
    };
  }
}
