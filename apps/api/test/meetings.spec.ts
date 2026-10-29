import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('Meetings Module - Google Meet & Zoom (Milestone P2-04)', () => {
  let meetingsService: MeetingsService;
  let auditService: AuditService;

  const testOwnerId = randomUUID();
  let createdMeetId: string;
  let createdZoomId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    meetingsService = new MeetingsService(auditService);

    // Create test user in PostgreSQL
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-meetings-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Google Meet Provisioning (P0 MVP)', () => {
    it('provisions Google Meet, assigns joinUrl, and emits requested/confirmed outbox events', async () => {
      const res = await meetingsService.createMeeting(
        testOwnerId,
        {
          provider: 'google-meet',
          title: 'Thesis Defense Practice Session',
          startsAt: '2026-11-15T09:00:00.000Z',
          endsAt: '2026-11-15T10:00:00.000Z',
          timezone: 'Asia/Jakarta',
        },
        'trace-meet-1',
      );

      expect(res.data.id).toBeDefined();
      expect(res.data.provider).toBe('google-meet');
      expect(res.data.status).toBe('confirmed');
      expect(res.data.joinUrl).toContain('meet.google.com');
      createdMeetId = res.data.id;

      // Verify outbox events in PostgreSQL
      const reqOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdMeetId,
          eventType: 'meeting.provisioning.requested.v1',
        },
      });
      expect(reqOutbox).not.toBeNull();

      const confOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdMeetId,
          eventType: 'meeting.provisioning.confirmed.v1',
        },
      });
      expect(confOutbox).not.toBeNull();
      const payload = confOutbox?.payload as { joinUrl?: string };
      expect(payload?.joinUrl).toContain('meet.google.com');
    });
  });

  describe('Zoom Meeting Provisioning (P0 MVP)', () => {
    it('provisions Zoom Meeting with numeric ID, join URL, and status confirmation', async () => {
      const res = await meetingsService.createMeeting(
        testOwnerId,
        {
          provider: 'zoom',
          title: 'Review Sprint Progress with Client',
          startsAt: '2026-11-15T14:00:00.000Z',
          endsAt: '2026-11-15T15:00:00.000Z',
          timezone: 'Asia/Jakarta',
        },
        'trace-zoom-1',
      );

      expect(res.data.id).toBeDefined();
      expect(res.data.provider).toBe('zoom');
      expect(res.data.status).toBe('confirmed');
      expect(res.data.joinUrl).toContain('zoom.us/j/');
      expect(res.data.externalMeetingId).toMatch(/^\d{10}$/);
      createdZoomId = res.data.id;

      // Verify meeting entity in PostgreSQL
      const meeting = await prisma.meeting.findUnique({
        where: { id: createdZoomId },
        include: { calendarEvent: true },
      });
      expect(meeting).not.toBeNull();
      expect(meeting?.calendarEvent).not.toBeNull();
      expect(meeting?.calendarEvent?.title).toBe('Review Sprint Progress with Client');
    });

    it('lists all meetings with calendar details', async () => {
      const list = await meetingsService.listMeetings(testOwnerId);
      expect(list.data.length).toBeGreaterThanOrEqual(2);

      const meet = list.data.find((m) => m.id === createdMeetId);
      const zoom = list.data.find((m) => m.id === createdZoomId);

      expect(meet?.provider).toBe('google-meet');
      expect(zoom?.provider).toBe('zoom');
      expect(meet?.calendarEvent?.title).toBe('Thesis Defense Practice Session');
    });

    it('rejects meeting creation with invalid time range (startsAt >= endsAt)', async () => {
      await expect(
        meetingsService.createMeeting(testOwnerId, {
          provider: 'zoom',
          title: 'Invalid Time Meeting',
          startsAt: '2026-11-15T10:00:00.000Z',
          endsAt: '2026-11-15T09:00:00.000Z',
        }),
      ).rejects.toThrow('Valid startsAt and endsAt');
    });
  });
});
