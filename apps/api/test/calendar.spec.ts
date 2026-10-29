import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { CalendarService, ExternalGoogleEvent } from '../src/modules/calendar/calendar.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('Calendar & Google Sync Engine (Milestone P2-03)', () => {
  let calendarService: CalendarService;
  let auditService: AuditService;

  const testOwnerId = randomUUID();
  let defaultCalendarId: string;
  let googleCalendarId: string;
  let createdEventId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    calendarService = new CalendarService(auditService);

    // Create test user in PostgreSQL
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-calendar-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });

    const cals = await calendarService.listCalendars(testOwnerId);
    defaultCalendarId = cals.data[0]!.id;

    // Create Google Calendar link
    const googleCal = await calendarService.createCalendar(testOwnerId, {
      provider: 'google',
      externalCalendarId: 'work-calendar-google@gmail.com',
    });
    googleCalendarId = googleCal.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Calendar Event CRUD & Outbox Emission', () => {
    it('creates a calendar event and atomically emits calendar.event.created.v1 outbox event', async () => {
      const res = await calendarService.createEvent(
        testOwnerId,
        {
          calendarId: defaultCalendarId,
          title: 'Thesis Defense Practice',
          startsAt: '2026-11-10T10:00:00.000Z',
          endsAt: '2026-11-10T11:00:00.000Z',
          timezone: 'Asia/Jakarta',
        },
        'trace-event-create',
      );

      expect(res.data.id).toBeDefined();
      expect(res.data.title).toBe('Thesis Defense Practice');
      expect(res.data.status).toBe('confirmed');
      expect(res.data.version).toBe(1);
      createdEventId = res.data.id;

      // Verify outbox event in PostgreSQL
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdEventId,
          eventType: 'calendar.event.created.v1',
        },
      });

      expect(outbox).not.toBeNull();
      expect(outbox?.aggregateType).toBe('calendar_event');
      expect(outbox?.traceId).toBe('trace-event-create');
    });

    it('updates event with optimistic concurrency protection and emits calendar.event.updated.v1', async () => {
      const updated = await calendarService.updateEvent(
        testOwnerId,
        createdEventId,
        {
          title: 'Thesis Defense Practice - Extended',
          endsAt: '2026-11-10T11:30:00.000Z',
          version: 1, // Matches current version
        },
        undefined,
        'trace-event-update',
      );

      expect(updated.data.title).toBe('Thesis Defense Practice - Extended');
      expect(updated.data.version).toBe(2);

      // Verify version conflict rejection
      await expect(
        calendarService.updateEvent(testOwnerId, createdEventId, {
          title: 'Stale Edit',
          version: 1,
        }),
      ).rejects.toThrow('Event version mismatch');
    });
  });

  describe('Conflict Detection Engine', () => {
    it('detects time overlaps accurately across events', async () => {
      // Event currently runs: 10:00 - 11:30 UTC
      // Query overlapping window: 11:00 - 12:00 UTC (overlaps by 30 mins)
      const conflict = await calendarService.detectConflicts(
        testOwnerId,
        new Date('2026-11-10T11:00:00.000Z'),
        new Date('2026-11-10T12:00:00.000Z'),
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictCount).toBe(1);
      expect(conflict.conflicts[0]!.id).toBe(createdEventId);

      // Query non-overlapping window: 12:00 - 13:00 UTC
      const noConflict = await calendarService.detectConflicts(
        testOwnerId,
        new Date('2026-11-10T12:00:00.000Z'),
        new Date('2026-11-10T13:00:00.000Z'),
      );

      expect(noConflict.hasConflict).toBe(false);
      expect(noConflict.conflictCount).toBe(0);
    });
  });

  describe('Google Calendar Webhook Inbound Ingest', () => {
    it('records incoming webhook in inbox and enqueues integration.sync.requested.v1 outbox event', async () => {
      const res = await calendarService.handleGoogleWebhook(
        'google-chan-123',
        'resource-987',
        'secret-token-xyz',
        'trace-webhook',
      );

      expect(res.status).toBe('acknowledged');
      expect(res.inboxId).toBeDefined();

      const inbox = await prisma.webhookInbox.findUnique({
        where: { id: res.inboxId },
      });
      expect(inbox).not.toBeNull();
      expect(inbox?.provider).toBe('google');

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: 'resource-987',
          eventType: 'integration.sync.requested.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });
  });

  describe('Two-Way Google Calendar Reconciliation Engine', () => {
    it('reconciles external events and handles HTTP 410 token recovery safely', async () => {
      const mockGoogleEvents: ExternalGoogleEvent[] = [
        {
          id: 'g-event-001',
          etag: 'etag-111',
          summary: 'Mentoring Session from Google Calendar',
          start: { dateTime: '2026-11-12T14:00:00.000Z' },
          end: { dateTime: '2026-11-12T15:00:00.000Z' },
          status: 'confirmed',
        },
        {
          id: 'g-event-002',
          etag: 'etag-222',
          summary: 'Cancelled Meeting',
          start: { dateTime: '2026-11-12T16:00:00.000Z' },
          end: { dateTime: '2026-11-12T17:00:00.000Z' },
          status: 'cancelled',
        },
      ];

      // Simulate sync with HTTP 410 Token Recovery
      const syncResult = await calendarService.syncGoogleCalendar(testOwnerId, googleCalendarId, {
        simulate410InvalidToken: true,
        externalEvents: mockGoogleEvents,
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.isFullResync).toBe(true);
      expect(syncResult.syncedCount).toBe(1); // 1 confirmed synced
      expect(syncResult.nextSyncToken).toBeDefined();

      // Verify event was upserted in PostgreSQL calendar_events
      const syncedEvent = await prisma.calendarEvent.findFirst({
        where: {
          calendarId: googleCalendarId,
          externalEventId: 'g-event-001',
        },
      });

      expect(syncedEvent).not.toBeNull();
      expect(syncedEvent?.title).toBe('Mentoring Session from Google Calendar');
      expect(syncedEvent?.source).toBe('google');
      expect(syncedEvent?.status).toBe('confirmed');

      // Verify completion outbox event
      const syncOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: googleCalendarId,
          eventType: 'integration.sync.completed.v1',
        },
      });
      expect(syncOutbox).not.toBeNull();
    });
  });
});
