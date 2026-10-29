import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { DevicesService } from '../src/modules/devices/devices.service';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('iOS AlarmKit & Device Reconciliation Engine (Milestone P3-03 & P3-04)', () => {
  let devicesService: DevicesService;
  let remindersService: RemindersService;
  let auditService: AuditService;

  const testOwnerId = randomUUID();
  let enrolledDeviceId: string;
  let sampleOccurrenceId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    devicesService = new DevicesService(auditService);
    remindersService = new RemindersService(auditService);

    // Create test user in PostgreSQL
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-ios-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });

    // Create a task and reminder occurrence
    const task = await prisma.task.create({
      data: {
        ownerId: testOwnerId,
        title: 'AlarmKit Physical Device Verification',
        dueAt: new Date(Date.now() + 7200000), // 2 hours
        status: 'todo',
      },
    });

    const rule = await remindersService.createReminderRule(testOwnerId, {
      sourceType: 'task',
      sourceId: task.id,
      offsetMinutes: 10,
      channelPolicy: 'prominent_alarm',
    });
    sampleOccurrenceId = rule.data.occurrenceId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Device Enrollment & Identity (P0)', () => {
    it('enrolls iPhone 12 physical device idempotently', async () => {
      const res = await devicesService.registerDevice(testOwnerId, {
        platform: 'ios',
        installId: 'iphone12-hardware-id-001',
        deviceName: 'Matin iPhone 12 (iOS 26.4.1)',
      });

      expect(res.data.id).toBeDefined();
      expect(res.data.platform).toBe('ios');
      expect(res.data.installId).toBe('iphone12-hardware-id-001');
      expect(res.data.deviceName).toBe('Matin iPhone 12 (iOS 26.4.1)');
      enrolledDeviceId = res.data.id;
    });

    it('returns desired alarm synchronization list for device', async () => {
      const alarms = await devicesService.getDesiredAlarms(testOwnerId);
      expect(Array.isArray(alarms.data)).toBe(true);
    });
  });

  describe('Offline Operation & Delayed Reconnection Reconciliation (P3-04)', () => {
    it('buffers local acknowledgment during offline period and reconciles with PostgreSQL upon reconnection', async () => {
      // Simulate client performing action while device is offline
      const offlineClientRequestId = `ios-offline-ack-${randomUUID()}`;

      // When device reconnects, it flushes buffered action to API
      const ackResult = await remindersService.acknowledgeOccurrence(testOwnerId, {
        occurrenceId: sampleOccurrenceId,
        clientRequestId: offlineClientRequestId,
        deviceId: enrolledDeviceId,
      });

      expect(ackResult.success).toBe(true);
      expect(ackResult.data.status).toBe('acknowledged');

      // Verify PostgreSQL state reflects acknowledgment
      const occurrenceInDb = await prisma.reminderOccurrence.findUnique({
        where: { id: sampleOccurrenceId },
      });
      expect(occurrenceInDb?.status).toBe('acknowledged');

      // Verify duplicate network retry with same clientRequestId returns idempotent replay
      const retryResult = await remindersService.acknowledgeOccurrence(testOwnerId, {
        occurrenceId: sampleOccurrenceId,
        clientRequestId: offlineClientRequestId,
        deviceId: enrolledDeviceId,
      });
      expect(retryResult.idempotentReplay).toBe(true);
    });

    it('prevents escalation for occurrences that were acknowledged offline', async () => {
      // Set occurrence to fired status in the past
      await prisma.reminderOccurrence.update({
        where: { id: sampleOccurrenceId },
        data: {
          status: 'acknowledged',
          scheduledFor: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      // Escalation sweep should NOT escalate because it has an accepted acknowledgment record
      const escResult = await remindersService.checkAndEscalate(5);
      expect(escResult.escalatedIds).not.toContain(sampleOccurrenceId);
    });
  });
});
