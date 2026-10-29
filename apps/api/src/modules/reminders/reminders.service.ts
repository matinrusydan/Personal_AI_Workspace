import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, createOutboxEvent } from '@paw/database';
import { AuditService } from '../audit/audit.service';
import { createHash } from 'crypto';

export interface CreateReminderRuleDto {
  sourceType: 'task' | 'calendar_event';
  sourceId: string;
  offsetMinutes: number; // e.g. 60 (1 hr before), 10 (10 mins before), 0 (at time)
  channelPolicy?: string; // 'default', 'prominent_alarm', 'telegram_fallback'
}

export interface AcknowledgeReminderDto {
  occurrenceId: string;
  clientRequestId: string;
  deviceId?: string;
}

export interface SnoozeReminderDto {
  occurrenceId: string;
  clientRequestId: string;
  minutes: number;
  deviceId?: string;
}

@Injectable()
export class RemindersService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Generates deterministic occurrence key to avoid duplicate reminders
   */
  private generateOccurrenceKey(ruleId: string, scheduledFor: Date): string {
    const raw = `${ruleId}_${scheduledFor.toISOString()}`;
    return createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  async listReminders(ownerId: string, status?: string) {
    const whereOccurrence: Record<string, unknown> = {};
    if (status) {
      whereOccurrence['status'] = status;
    }

    const rules = await prisma.reminderRule.findMany({
      where: { ownerId, enabled: true },
      include: {
        occurrences: {
          where: whereOccurrence,
          orderBy: { scheduledFor: 'asc' },
          include: {
            alarmAcknowledgments: true,
            deviceAlarms: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: rules.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        offsetMinutes: r.offsetMinutes,
        channelPolicy: r.channelPolicy,
        enabled: r.enabled,
        occurrences: r.occurrences.map((o) => ({
          id: o.id,
          occurrenceKey: o.occurrenceKey,
          scheduledFor: o.scheduledFor.toISOString(),
          status: o.status,
          attemptVersion: o.attemptVersion,
          acknowledgmentsCount: o.alarmAcknowledgments.length,
          deviceAlarms: o.deviceAlarms.map((da) => ({
            id: da.id,
            status: da.status,
            deviceId: da.deviceId,
          })),
        })),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Creates a reminder rule and schedules its initial occurrence atomically
   */
  async createReminderRule(ownerId: string, dto: CreateReminderRuleDto, traceId?: string) {
    if (dto.offsetMinutes < 0) {
      throw new BadRequestException('offsetMinutes must be non-negative');
    }

    let targetDate: Date | null = null;
    let title = 'Reminder';

    // Verify source existence and calculate due date
    if (dto.sourceType === 'task') {
      const task = await prisma.task.findFirst({
        where: { id: dto.sourceId, ownerId },
      });
      if (!task) {
        throw new NotFoundException(`Task ${dto.sourceId} not found`);
      }
      if (!task.dueAt) {
        throw new BadRequestException(`Task ${dto.sourceId} has no due date set`);
      }
      targetDate = task.dueAt;
      title = `Task: ${task.title}`;
    } else if (dto.sourceType === 'calendar_event') {
      const event = await prisma.calendarEvent.findFirst({
        where: { id: dto.sourceId, ownerId },
      });
      if (!event) {
        throw new NotFoundException(`Calendar event ${dto.sourceId} not found`);
      }
      targetDate = event.startsAt;
      title = `Event: ${event.title}`;
    } else {
      throw new BadRequestException(`Invalid sourceType: ${dto.sourceType}`);
    }

    // Calculate scheduled time: targetDate - offsetMinutes
    const scheduledFor = new Date(targetDate.getTime() - dto.offsetMinutes * 60000);

    const result = await prisma.$transaction(async (tx) => {
      const rule = await tx.reminderRule.create({
        data: {
          ownerId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          offsetMinutes: dto.offsetMinutes,
          channelPolicy: dto.channelPolicy || 'default',
          enabled: true,
        },
      });

      const occurrenceKey = this.generateOccurrenceKey(rule.id, scheduledFor);

      const occurrence = await tx.reminderOccurrence.create({
        data: {
          ruleId: rule.id,
          occurrenceKey,
          scheduledFor,
          status: 'scheduled',
          attemptVersion: 1,
        },
      });

      // Emit outbox event
      await createOutboxEvent(tx, {
        aggregateType: 'reminder',
        aggregateId: occurrence.id,
        eventType: 'reminder.occurrence.scheduled.v1',
        payload: {
          ruleId: rule.id,
          occurrenceId: occurrence.id,
          sourceType: rule.sourceType,
          sourceId: rule.sourceId,
          title,
          scheduledFor: scheduledFor.toISOString(),
          offsetMinutes: rule.offsetMinutes,
          channelPolicy: rule.channelPolicy,
        },
        traceId,
      });

      return { rule, occurrence };
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'reminder.rule.created',
      target: result.rule.id,
      traceId,
      metadata: {
        occurrenceId: result.occurrence.id,
        scheduledFor: scheduledFor.toISOString(),
      },
    });

    return {
      data: {
        ruleId: result.rule.id,
        occurrenceId: result.occurrence.id,
        scheduledFor: scheduledFor.toISOString(),
        status: result.occurrence.status,
      },
    };
  }

  /**
   * Idempotent Acknowledgment of a reminder occurrence
   */
  async acknowledgeOccurrence(ownerId: string, dto: AcknowledgeReminderDto, traceId?: string) {
    // 1. Idempotency check: see if clientRequestId already processed
    const existingAck = await prisma.alarmAcknowledgment.findUnique({
      where: { clientRequestId: dto.clientRequestId },
    });

    if (existingAck) {
      return {
        success: true,
        idempotentReplay: true,
        data: {
          occurrenceId: existingAck.occurrenceId,
          action: existingAck.action,
          actedAt: existingAck.actedAt.toISOString(),
        },
      };
    }

    // 2. Verify occurrence ownership
    const occurrence = await prisma.reminderOccurrence.findUnique({
      where: { id: dto.occurrenceId },
      include: {
        rule: true,
      },
    });

    if (!occurrence || occurrence.rule.ownerId !== ownerId) {
      throw new NotFoundException(`Reminder occurrence ${dto.occurrenceId} not found`);
    }

    // 3. Resolve device
    let actorDeviceId = dto.deviceId;
    if (!actorDeviceId) {
      const defaultDevice = await prisma.device.findFirst({
        where: { ownerId },
      });
      if (defaultDevice) {
        actorDeviceId = defaultDevice.id;
      } else {
        const dev = await prisma.device.create({
          data: {
            ownerId,
            platform: 'web',
            installId: `web-fallback-${ownerId.substring(0, 8)}`,
          },
        });
        actorDeviceId = dev.id;
      }
    }

    const now = new Date();

    // 4. Atomic transaction: record acknowledgment + update status + emit outbox
    await prisma.$transaction(async (tx) => {
      await tx.alarmAcknowledgment.create({
        data: {
          occurrenceId: occurrence.id,
          actorDeviceId: actorDeviceId!,
          action: 'acknowledge',
          actedAt: now,
          clientRequestId: dto.clientRequestId,
        },
      });

      await tx.reminderOccurrence.update({
        where: { id: occurrence.id },
        data: { status: 'acknowledged' },
      });

      // Update any device alarms
      await tx.deviceAlarm.updateMany({
        where: { occurrenceId: occurrence.id },
        data: { status: 'acknowledged' },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'reminder',
        aggregateId: occurrence.id,
        eventType: 'reminder.occurrence.acknowledged.v1',
        payload: {
          occurrenceId: occurrence.id,
          ruleId: occurrence.ruleId,
          actorDeviceId,
          actedAt: now.toISOString(),
        },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'reminder.occurrence.acknowledged',
      target: occurrence.id,
      traceId,
      metadata: { clientRequestId: dto.clientRequestId },
    });

    return {
      success: true,
      idempotentReplay: false,
      data: {
        occurrenceId: occurrence.id,
        status: 'acknowledged',
        actedAt: now.toISOString(),
      },
    };
  }

  /**
   * Idempotent Snooze of a reminder occurrence
   */
  async snoozeOccurrence(ownerId: string, dto: SnoozeReminderDto, traceId?: string) {
    if (dto.minutes <= 0) {
      throw new BadRequestException('Snooze minutes must be positive');
    }

    // Idempotency check
    const existingAck = await prisma.alarmAcknowledgment.findUnique({
      where: { clientRequestId: dto.clientRequestId },
    });

    if (existingAck) {
      return {
        success: true,
        idempotentReplay: true,
        data: {
          occurrenceId: existingAck.occurrenceId,
          action: existingAck.action,
        },
      };
    }

    const occurrence = await prisma.reminderOccurrence.findUnique({
      where: { id: dto.occurrenceId },
      include: { rule: true },
    });

    if (!occurrence || occurrence.rule.ownerId !== ownerId) {
      throw new NotFoundException(`Reminder occurrence ${dto.occurrenceId} not found`);
    }

    let actorDeviceId = dto.deviceId;
    if (!actorDeviceId) {
      const defaultDevice = await prisma.device.findFirst({ where: { ownerId } });
      actorDeviceId = defaultDevice
        ? defaultDevice.id
        : (
            await prisma.device.create({
              data: {
                ownerId,
                platform: 'web',
                installId: `web-fallback-${ownerId.substring(0, 8)}`,
              },
            })
          ).id;
    }

    const now = new Date();
    const newScheduledFor = new Date(now.getTime() + dto.minutes * 60000);

    await prisma.$transaction(async (tx) => {
      await tx.alarmAcknowledgment.create({
        data: {
          occurrenceId: occurrence.id,
          actorDeviceId: actorDeviceId!,
          action: 'snooze',
          actedAt: now,
          clientRequestId: dto.clientRequestId,
        },
      });

      await tx.reminderOccurrence.update({
        where: { id: occurrence.id },
        data: {
          scheduledFor: newScheduledFor,
          status: 'snoozed',
          attemptVersion: occurrence.attemptVersion + 1,
        },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'reminder',
        aggregateId: occurrence.id,
        eventType: 'reminder.occurrence.snoozed.v1',
        payload: {
          occurrenceId: occurrence.id,
          ruleId: occurrence.ruleId,
          snoozeMinutes: dto.minutes,
          newScheduledFor: newScheduledFor.toISOString(),
          attemptVersion: occurrence.attemptVersion + 1,
        },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'reminder.occurrence.snoozed',
      target: occurrence.id,
      traceId,
      metadata: { minutes: dto.minutes, newScheduledFor: newScheduledFor.toISOString() },
    });

    return {
      success: true,
      idempotentReplay: false,
      data: {
        occurrenceId: occurrence.id,
        status: 'snoozed',
        newScheduledFor: newScheduledFor.toISOString(),
        attemptVersion: occurrence.attemptVersion + 1,
      },
    };
  }

  /**
   * Recovery Engine: Scans PostgreSQL for due occurrences and enqueues to BullMQ
   */
  async sweepDueOccurrences(windowDate = new Date()) {
    const dueOccurrences = await prisma.reminderOccurrence.findMany({
      where: {
        status: { in: ['scheduled', 'snoozed'] },
        scheduledFor: { lte: windowDate },
      },
      include: {
        rule: true,
      },
      take: 50,
    });

    const triggered: string[] = [];

    for (const occ of dueOccurrences) {
      await prisma.$transaction(async (tx) => {
        await tx.reminderOccurrence.update({
          where: { id: occ.id },
          data: { status: 'fired' },
        });

        await createOutboxEvent(tx, {
          aggregateType: 'reminder',
          aggregateId: occ.id,
          eventType: 'reminder.occurrence.due.v1',
          payload: {
            occurrenceId: occ.id,
            ruleId: occ.ruleId,
            sourceType: occ.rule.sourceType,
            sourceId: occ.rule.sourceId,
            channelPolicy: occ.rule.channelPolicy,
            scheduledFor: occ.scheduledFor.toISOString(),
          },
        });
      });
      triggered.push(occ.id);
    }

    return { sweptCount: triggered.length, triggeredIds: triggered };
  }

  /**
   * Escalation Engine: Identifies fired occurrences unacknowledged after escalation window
   */
  async checkAndEscalate(gracePeriodMinutes = 5) {
    const cutoffTime = new Date(Date.now() - gracePeriodMinutes * 60000);

    const unacknowledged = await prisma.reminderOccurrence.findMany({
      where: {
        status: 'fired',
        scheduledFor: { lte: cutoffTime },
        alarmAcknowledgments: {
          none: { action: 'acknowledge' },
        },
      },
      include: { rule: true },
      take: 20,
    });

    const escalated: string[] = [];

    for (const occ of unacknowledged) {
      await prisma.$transaction(async (tx) => {
        await tx.reminderOccurrence.update({
          where: { id: occ.id },
          data: { status: 'escalated' },
        });

        await createOutboxEvent(tx, {
          aggregateType: 'reminder',
          aggregateId: occ.id,
          eventType: 'reminder.occurrence.escalated.v1',
          payload: {
            occurrenceId: occ.id,
            ruleId: occ.ruleId,
            channelPolicy: 'escalation_broadcast',
            unacknowledgedDurationMinutes: gracePeriodMinutes,
          },
        });
      });
      escalated.push(occ.id);
    }

    return { escalatedCount: escalated.length, escalatedIds: escalated };
  }
}
