import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('Persistent Reminders, Recovery & Escalation (Milestone P3-01)', () => {
  let remindersService: RemindersService;
  let auditService: AuditService;

  const testOwnerId = randomUUID();
  let createdTaskId: string;
  let createdOccurrenceId: string;
  let sweepOccurrenceId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    remindersService = new RemindersService(auditService);

    // Create test user in PostgreSQL
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-reminders-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });

    // Create a task with due date
    const task = await prisma.task.create({
      data: {
        ownerId: testOwnerId,
        title: 'Task with Deadline for Reminder',
        dueAt: new Date(Date.now() + 3600000), // 1 hour from now
        status: 'todo',
      },
    });
    createdTaskId = task.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Reminder Rules & Occurrence Scheduling', () => {
    it('creates a reminder rule and schedules its occurrence with outbox event', async () => {
      const res = await remindersService.createReminderRule(
        testOwnerId,
        {
          sourceType: 'task',
          sourceId: createdTaskId,
          offsetMinutes: 15, // 15 mins before due date
          channelPolicy: 'prominent_alarm',
        },
        'trace-rem-1',
      );

      expect(res.data.ruleId).toBeDefined();
      expect(res.data.occurrenceId).toBeDefined();
      expect(res.data.status).toBe('scheduled');
      createdOccurrenceId = res.data.occurrenceId;

      // Verify occurrence in PostgreSQL
      const occurrence = await prisma.reminderOccurrence.findUnique({
        where: { id: createdOccurrenceId },
      });
      expect(occurrence).not.toBeNull();
      expect(occurrence?.attemptVersion).toBe(1);

      // Verify atomic outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdOccurrenceId,
          eventType: 'reminder.occurrence.scheduled.v1',
        },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.traceId).toBe('trace-rem-1');
    });

    it('lists reminders with occurrences for owner', async () => {
      const list = await remindersService.listReminders(testOwnerId);
      expect(list.data.length).toBeGreaterThanOrEqual(1);

      const rule = list.data.find((r) => r.sourceId === createdTaskId);
      expect(rule).toBeDefined();
      expect(rule?.occurrences.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Idempotent Snooze & Acknowledgment', () => {
    it('snoozes a reminder occurrence idempotently and emits reminder.occurrence.snoozed.v1', async () => {
      const clientReqId = randomUUID();

      // First snooze call
      const snoozeRes = await remindersService.snoozeOccurrence(
        testOwnerId,
        {
          occurrenceId: createdOccurrenceId,
          clientRequestId: clientReqId,
          minutes: 10,
        },
        'trace-snooze-1',
      );

      expect(snoozeRes.success).toBe(true);
      expect(snoozeRes.idempotentReplay).toBe(false);
      expect(snoozeRes.data.status).toBe('snoozed');
      expect(snoozeRes.data.attemptVersion).toBe(2);

      // Verify second call with identical clientRequestId returns idempotentReplay: true
      const replayRes = await remindersService.snoozeOccurrence(testOwnerId, {
        occurrenceId: createdOccurrenceId,
        clientRequestId: clientReqId,
        minutes: 10,
      });
      expect(replayRes.success).toBe(true);
      expect(replayRes.idempotentReplay).toBe(true);

      // Verify outbox event in PostgreSQL
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdOccurrenceId,
          eventType: 'reminder.occurrence.snoozed.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });

    it('acknowledges a reminder occurrence idempotently and emits reminder.occurrence.acknowledged.v1', async () => {
      const clientReqId = randomUUID();

      // First acknowledgment call
      const ackRes = await remindersService.acknowledgeOccurrence(
        testOwnerId,
        {
          occurrenceId: createdOccurrenceId,
          clientRequestId: clientReqId,
        },
        'trace-ack-1',
      );

      expect(ackRes.success).toBe(true);
      expect(ackRes.idempotentReplay).toBe(false);
      expect(ackRes.data.status).toBe('acknowledged');

      // Second call with same clientRequestId returns idempotent replay
      const replayAck = await remindersService.acknowledgeOccurrence(testOwnerId, {
        occurrenceId: createdOccurrenceId,
        clientRequestId: clientReqId,
      });
      expect(replayAck.success).toBe(true);
      expect(replayAck.idempotentReplay).toBe(true);

      // Verify occurrence status in DB
      const occInDb = await prisma.reminderOccurrence.findUnique({
        where: { id: createdOccurrenceId },
      });
      expect(occInDb?.status).toBe('acknowledged');

      // Verify outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdOccurrenceId,
          eventType: 'reminder.occurrence.acknowledged.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });
  });

  describe('Recovery Scheduler & Escalation Engine', () => {
    it('sweeps due occurrences from PostgreSQL and emits reminder.occurrence.due.v1', async () => {
      // Create a past-due occurrence
      const pastTask = await prisma.task.create({
        data: {
          ownerId: testOwnerId,
          title: 'Past Task for Sweep Test',
          dueAt: new Date(Date.now() - 60000), // 1 min in the past
          status: 'todo',
        },
      });

      const rule = await remindersService.createReminderRule(testOwnerId, {
        sourceType: 'task',
        sourceId: pastTask.id,
        offsetMinutes: 0,
      });
      sweepOccurrenceId = rule.data.occurrenceId;

      // Execute sweep
      const sweepResult = await remindersService.sweepDueOccurrences();
      expect(sweepResult.sweptCount).toBeGreaterThanOrEqual(1);
      expect(sweepResult.triggeredIds).toContain(sweepOccurrenceId);

      const sweptInDb = await prisma.reminderOccurrence.findUnique({
        where: { id: sweepOccurrenceId },
      });
      expect(sweptInDb?.status).toBe('fired');

      // Verify due outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: sweepOccurrenceId,
          eventType: 'reminder.occurrence.due.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });

    it('identifies unacknowledged fired occurrences and triggers escalation', async () => {
      // Artificially age the sweep occurrence scheduledFor to 10 minutes ago
      await prisma.reminderOccurrence.update({
        where: { id: sweepOccurrenceId },
        data: {
          scheduledFor: new Date(Date.now() - 10 * 60000),
        },
      });

      // Execute escalation with 5-minute grace period
      const escResult = await remindersService.checkAndEscalate(5);
      expect(escResult.escalatedCount).toBeGreaterThanOrEqual(1);
      expect(escResult.escalatedIds).toContain(sweepOccurrenceId);

      const escalatedInDb = await prisma.reminderOccurrence.findUnique({
        where: { id: sweepOccurrenceId },
      });
      expect(escalatedInDb?.status).toBe('escalated');

      // Verify escalation outbox event
      const escOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: sweepOccurrenceId,
          eventType: 'reminder.occurrence.escalated.v1',
        },
      });
      expect(escOutbox).not.toBeNull();
    });
  });
});
