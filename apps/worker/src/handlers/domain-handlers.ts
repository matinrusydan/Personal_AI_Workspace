import { prisma } from '@paw/database';
import { OutboxJobData } from '../processors/outbox.processor';

/**
 * Real domain event handlers executed by the BullMQ worker
 * for transactional outbox events per docs/EVENT_FLOWS.md
 */
export async function handleDomainEvent(event: OutboxJobData): Promise<void> {
  const { eventType, payload, aggregateId } = event;

  switch (eventType) {
    case 'task.updated.v1': {
      // If task marked done, cancel any pending reminder occurrences
      if (payload['status'] === 'done') {
        const rules = await prisma.reminderRule.findMany({
          where: { sourceType: 'task', sourceId: aggregateId },
          select: { id: true },
        });
        const ruleIds = rules.map((r) => r.id);
        if (ruleIds.length > 0) {
          await prisma.reminderOccurrence.updateMany({
            where: {
              ruleId: { in: ruleIds },
              status: { in: ['scheduled', 'snoozed'] },
            },
            data: { status: 'canceled' },
          });
          await prisma.deviceAlarm.updateMany({
            where: {
              occurrence: { ruleId: { in: ruleIds } },
              status: { in: ['pending', 'scheduled'] },
            },
            data: { status: 'canceled' },
          });
        }
      }
      break;
    }

    case 'task.deleted.v1': {
      // Cancel reminder rules and occurrences for deleted task
      const rules = await prisma.reminderRule.findMany({
        where: { sourceType: 'task', sourceId: aggregateId },
        select: { id: true },
      });
      const ruleIds = rules.map((r) => r.id);
      if (ruleIds.length > 0) {
        await prisma.reminderOccurrence.updateMany({
          where: {
            ruleId: { in: ruleIds },
            status: { in: ['scheduled', 'snoozed'] },
          },
          data: { status: 'canceled' },
        });
        await prisma.reminderRule.updateMany({
          where: { id: { in: ruleIds } },
          data: { enabled: false },
        });
      }
      break;
    }

    case 'calendar.event.canceled.v1': {
      // If calendar event is canceled, mark linked meetings as failed/canceled
      await prisma.meeting.updateMany({
        where: { calendarEventId: aggregateId },
        data: { provisioningStatus: 'failed' },
      });

      // Cancel pending reminder occurrences for this calendar event
      const rules = await prisma.reminderRule.findMany({
        where: { sourceType: 'calendar_event', sourceId: aggregateId },
        select: { id: true },
      });
      const ruleIds = rules.map((r) => r.id);
      if (ruleIds.length > 0) {
        await prisma.reminderOccurrence.updateMany({
          where: {
            ruleId: { in: ruleIds },
            status: { in: ['scheduled', 'snoozed'] },
          },
          data: { status: 'canceled' },
        });
      }
      break;
    }

    case 'meeting.canceled.v1': {
      // Meeting canceled -> mark provisioningStatus failed
      await prisma.meeting.updateMany({
        where: { id: aggregateId },
        data: { provisioningStatus: 'failed' },
      });
      break;
    }

    case 'reminder.occurrence.scheduled.v1': {
      // When reminder is scheduled, reconcile desired state for enrolled devices
      const occurrence = await prisma.reminderOccurrence.findUnique({
        where: { id: aggregateId },
        include: { rule: true },
      });

      if (occurrence) {
        const devices = await prisma.device.findMany({
          where: { ownerId: occurrence.rule.ownerId },
        });

        for (const dev of devices) {
          await prisma.deviceAlarm.upsert({
            where: {
              deviceId_occurrenceId: {
                deviceId: dev.id,
                occurrenceId: occurrence.id,
              },
            },
            create: {
              deviceId: dev.id,
              occurrenceId: occurrence.id,
              status: 'pending',
              requestVersion: occurrence.attemptVersion,
            },
            update: {
              status: 'pending',
              requestVersion: occurrence.attemptVersion,
            },
          });
        }
      }
      break;
    }

    case 'reminder.occurrence.acknowledged.v1': {
      // Mark all device alarms for this occurrence as acknowledged
      await prisma.deviceAlarm.updateMany({
        where: { occurrenceId: aggregateId },
        data: { status: 'acknowledged' },
      });
      break;
    }

    case 'reminder.occurrence.snoozed.v1': {
      // Update device alarms to pending for new snooze time
      await prisma.deviceAlarm.updateMany({
        where: { occurrenceId: aggregateId },
        data: { status: 'pending' },
      });
      break;
    }

    case 'reminder.rule.deleted.v1': {
      // Cancel device alarms for deleted rule
      await prisma.deviceAlarm.updateMany({
        where: { occurrence: { ruleId: aggregateId } },
        data: { status: 'canceled' },
      });
      break;
    }

    default:
      // Other events (e.g. audit, telemetry) are safely handled
      break;
  }
}
