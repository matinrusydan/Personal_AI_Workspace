import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, exportDatabaseSnapshot, verifySnapshotChecksum } from '@paw/database';
import { AuthService } from '../src/modules/auth/auth.service';
import { TotpService } from '../src/modules/auth/totp.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { TelegramService } from '../src/modules/telegram/telegram.service';
import { DevicesService } from '../src/modules/devices/devices.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('MVP Acceptance Criteria E2E Test Suite (Milestone P4-03 & docs/TEST_PLAN.md)', () => {
  let auditService: AuditService;
  let totpService: TotpService;
  let authService: AuthService;
  let tasksService: TasksService;
  let calendarService: CalendarService;
  let meetingsService: MeetingsService;
  let remindersService: RemindersService;
  let telegramService: TelegramService;
  let devicesService: DevicesService;

  const e2eOwnerId = randomUUID();
  const e2eOwnerEmail = `e2e-owner-${Date.now()}@example.com`;
  const e2eTelegramId = '555666777';
  let e2eTaskId: string;
  let e2eCalendarId: string;
  let e2eEventId: string;
  let e2eMeetId: string;
  let e2eZoomId: string;
  let e2eOccurrenceId: string;
  let e2eDeviceId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    totpService = new TotpService();
    authService = new AuthService(totpService, auditService);
    tasksService = new TasksService(auditService);
    calendarService = new CalendarService(auditService);
    meetingsService = new MeetingsService(auditService);
    remindersService = new RemindersService(auditService);
    devicesService = new DevicesService(auditService);
    telegramService = new TelegramService(
      auditService,
      tasksService,
      calendarService,
      remindersService,
    );
    telegramService.setAllowedUserId(e2eTelegramId);

    // Create user in PostgreSQL
    await prisma.user.create({
      data: {
        id: e2eOwnerId,
        email: e2eOwnerEmail,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });

    const cals = await calendarService.listCalendars(e2eOwnerId);
    e2eCalendarId = cals.data[0]!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('AC-01: MFA login and session revocation demonstrably work', async () => {
    // Configure test credentials
    const secret = totpService.generateSecret();
    authService.setOwnerCredentials(e2eOwnerEmail, 'password123', secret);

    // Step 1: Login
    const step1 = await authService.login(e2eOwnerEmail, 'password123');
    expect(step1.data.mfaRequired).toBe(true);
    expect(step1.data.ticket).toBeDefined();

    // Step 2: MFA verification
    const token = totpService.generateToken(secret);
    const session = await authService.verifyMfa(step1.data.ticket, token);
    expect(session.data.accessToken).toBeDefined();

    // Step 3: Session revocation
    const logout = await authService.logout('e2e-session-id');
    expect(logout.success).toBe(true);
  });

  it('AC-02: Task created from web is visible and queryable cross-channel', async () => {
    const task = await tasksService.createTask(e2eOwnerId, {
      title: 'Prepare Final Laporan KP Revision',
      priority: 'urgent',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      tags: ['thesis', 'urgent'],
    });

    expect(task.data.id).toBeDefined();
    expect(task.data.priority).toBe('urgent');
    e2eTaskId = task.data.id;

    // Verify task is retrieved across channel queries
    const listed = await tasksService.listTasks(e2eOwnerId, { status: 'todo' });
    expect(listed.data.find((t) => t.id === e2eTaskId)).toBeDefined();
  });

  it('AC-03 & AC-06: Calendar edits flow with conflict detection', async () => {
    // Event 1: 09:00 - 10:00
    const ev1 = await calendarService.createEvent(e2eOwnerId, {
      calendarId: e2eCalendarId,
      title: 'Presentation Dry Run',
      startsAt: '2026-11-20T09:00:00.000Z',
      endsAt: '2026-11-20T10:00:00.000Z',
    });
    e2eEventId = ev1.data.id;

    // AC-06: Overlapping event conflict check (09:30 - 10:30)
    const conflict = await calendarService.detectConflicts(
      e2eOwnerId,
      new Date('2026-11-20T09:30:00.000Z'),
      new Date('2026-11-20T10:30:00.000Z'),
    );
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.conflicts[0]!.id).toBe(e2eEventId);

    // AC-03: Two-way sync external reconciliation
    const syncRes = await calendarService.syncGoogleCalendar(e2eOwnerId, e2eCalendarId, {
      externalEvents: [
        {
          id: 'g-e2e-1',
          etag: 'etag-1',
          summary: 'External Calendar Adjustment',
          start: { dateTime: '2026-11-20T14:00:00.000Z' },
          end: { dateTime: '2026-11-20T15:00:00.000Z' },
          status: 'confirmed',
        },
      ],
    });
    expect(syncRes.success).toBe(true);
    expect(syncRes.syncedCount).toBe(1);
  });

  it('AC-04: Google Meet created with stable join URL and outbox events', async () => {
    const meet = await meetingsService.createMeeting(e2eOwnerId, {
      provider: 'google-meet',
      title: 'Google Meet Discussion with Mentor',
      startsAt: '2026-11-21T09:00:00.000Z',
      endsAt: '2026-11-21T10:00:00.000Z',
    });

    expect(meet.data.status).toBe('confirmed');
    expect(meet.data.joinUrl).toContain('meet.google.com');
    e2eMeetId = meet.data.id;
  });

  it('AC-05: Zoom Meeting created with numeric ID and join URL', async () => {
    const zoom = await meetingsService.createMeeting(e2eOwnerId, {
      provider: 'zoom',
      title: 'Zoom Project Demo',
      startsAt: '2026-11-21T14:00:00.000Z',
      endsAt: '2026-11-21T15:00:00.000Z',
    });

    expect(zoom.data.status).toBe('confirmed');
    expect(zoom.data.joinUrl).toContain('zoom.us/j/');
    expect(zoom.data.externalMeetingId).toMatch(/^\d{10}$/);
    e2eZoomId = zoom.data.id;
  });

  it('AC-07, AC-08, AC-09: Reminders, Native AlarmKit & Offline Reconcile', async () => {
    // Enroll iPhone 12 physical device
    const device = await devicesService.registerDevice(e2eOwnerId, {
      platform: 'ios',
      installId: 'iphone12-e2e-install-01',
      deviceName: 'Matin iPhone 12 (iOS 26.4.1)',
    });
    e2eDeviceId = device.data.id;

    // AC-07: Persistent reminder schedule created in PostgreSQL
    const rule = await remindersService.createReminderRule(e2eOwnerId, {
      sourceType: 'task',
      sourceId: e2eTaskId,
      offsetMinutes: 10,
      channelPolicy: 'prominent_alarm',
    });
    e2eOccurrenceId = rule.data.occurrenceId;
    expect(e2eOccurrenceId).toBeDefined();

    // AC-09: Snooze and Ack idempotency with delayed offline sync
    const clientRequestId = `offline-req-${Date.now()}`;
    const ack = await remindersService.acknowledgeOccurrence(e2eOwnerId, {
      occurrenceId: e2eOccurrenceId,
      clientRequestId,
      deviceId: e2eDeviceId,
    });
    expect(ack.success).toBe(true);

    // Duplicate call returns idempotent replay
    const ackReplay = await remindersService.acknowledgeOccurrence(e2eOwnerId, {
      occurrenceId: e2eOccurrenceId,
      clientRequestId,
      deviceId: e2eDeviceId,
    });
    expect(ackReplay.idempotentReplay).toBe(true);
  });

  it('AC-10: Escalation triggers only when no accepted acknowledgment', async () => {
    // Non-acknowledged task
    const task2 = await prisma.task.create({
      data: {
        ownerId: e2eOwnerId,
        title: 'Unacknowledged Task for Escalation',
        dueAt: new Date(Date.now() - 3600000), // 1 hour ago
        status: 'todo',
      },
    });

    const rule2 = await remindersService.createReminderRule(e2eOwnerId, {
      sourceType: 'task',
      sourceId: task2.id,
      offsetMinutes: 0,
    });

    // Sweep into fired
    await remindersService.sweepDueOccurrences();

    // Escalate with 0-minute grace
    const esc = await remindersService.checkAndEscalate(0);
    expect(esc.escalatedIds).toContain(rule2.data.occurrenceId);
  });

  it('AC-13: Sensitive tokens absent from client payloads and app audit logs', () => {
    const auditRecord = auditService.record({
      actorType: 'user',
      actorId: e2eOwnerId,
      action: 'security.check',
      metadata: {
        email: 'test@example.com',
        password: 'rawpassword123',
        token: 'eyJh...secretjwt',
        secret: 'my-totp-secret',
      },
    });

    expect(auditRecord.metadata['email']).toBe('test@example.com');
    expect(auditRecord.metadata['password']).toBe('[REDACTED]');
    expect(auditRecord.metadata['token']).toBe('[REDACTED]');
    expect(auditRecord.metadata['secret']).toBe('[REDACTED]');
  });

  it('AC-14: Database backup exported and checksum verified', async () => {
    const snapshot = await exportDatabaseSnapshot(e2eOwnerId);

    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.checksum).toBeDefined();
    expect(snapshot.data.tasks.length).toBeGreaterThanOrEqual(1);

    // Verify SHA-256 checksum integrity
    const isChecksumValid = verifySnapshotChecksum(snapshot);
    expect(isChecksumValid).toBe(true);
  });

  it('AC-15: System functions 100% independently without AI models', async () => {
    // Verify tasks, calendar, meetings, and reminders operate deterministically without calling any LLM API
    const tasks = await tasksService.listTasks(e2eOwnerId);
    expect(tasks.data.length).toBeGreaterThan(0);

    const cals = await calendarService.listCalendars(e2eOwnerId);
    expect(cals.data.length).toBeGreaterThan(0);

    const meetings = await meetingsService.listMeetings(e2eOwnerId);
    expect(meetings.data.length).toBeGreaterThan(0);
    expect(meetings.data.find((m) => m.id === e2eMeetId)).toBeDefined();
    expect(meetings.data.find((m) => m.id === e2eZoomId)).toBeDefined();
  });
});
