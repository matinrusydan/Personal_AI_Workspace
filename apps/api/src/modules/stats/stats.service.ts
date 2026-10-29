import { Injectable } from '@nestjs/common';
import { prisma } from '@paw/database';

@Injectable()
export class StatsService {
  async getOverviewStats(ownerId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      activeTasksCount,
      totalTasksCount,
      todayMeetingsCount,
      totalMeetingsCount,
      totalEventsCount,
      devices,
      outboxPendingCount,
    ] = await Promise.all([
      prisma.task.count({
        where: { ownerId, status: { not: 'done' } },
      }),
      prisma.task.count({
        where: { ownerId },
      }),
      prisma.calendarEvent.count({
        where: {
          ownerId,
          status: { not: 'cancelled' },
          startsAt: { lte: endOfToday },
          endsAt: { gte: startOfToday },
        },
      }),
      prisma.meeting.count({
        where: { ownerId, provisioningStatus: 'confirmed' },
      }),
      prisma.calendarEvent.count({
        where: { ownerId, status: { not: 'cancelled' } },
      }),
      prisma.device.findMany({
        where: { ownerId },
        orderBy: { lastSeenAt: 'desc' },
      }),
      prisma.outboxEvent.count({
        where: { deliveredAt: null },
      }),
    ]);

    // Check if any device has been active in last 24 hours
    const activeIosDevice = devices.find(
      (d) => d.platform === 'ios' && Date.now() - d.lastSeenAt.getTime() < 86400000,
    );

    return {
      data: {
        activeTasksCount,
        totalTasksCount,
        todayMeetingsCount,
        totalMeetingsCount,
        totalEventsCount,
        devicesCount: devices.length,
        devices: devices.map((d) => ({
          id: d.id,
          platform: d.platform,
          installId: d.installId,
          deviceName: d.deviceName,
          lastSeenAt: d.lastSeenAt.toISOString(),
          registeredAt: d.registeredAt.toISOString(),
        })),
        isIosDeviceReady: !!activeIosDevice || devices.some((d) => d.platform === 'ios'),
        outboxPendingCount,
        systemHealth: '100% Outbox Sync Active',
        asOf: new Date().toISOString(),
      },
    };
  }
}
