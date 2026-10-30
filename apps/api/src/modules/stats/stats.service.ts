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

    // A recent heartbeat shows the app contacted the server; it does not prove
    // AlarmKit authorization, successful local scheduling, or audible delivery.
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
          connectionState: Date.now() - d.lastSeenAt.getTime() < 86400000 ? 'recently_seen' : 'stale',
        })),
        // Heartbeat only: never claim AlarmKit is ready based on enrollment alone.
        isIosDeviceReady: false,
        iosDeviceRecentlySeen: !!activeIosDevice,
        outboxPendingCount,
        systemHealth: outboxPendingCount === 0 ? 'outbox_empty_at_query_time' : 'outbox_pending',
        asOf: new Date().toISOString(),
      },
    };
  }
}
