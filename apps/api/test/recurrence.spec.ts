import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecurrenceService } from '../src/modules/recurrence/recurrence.service';
import { prisma } from '@paw/database';
import { randomUUID } from 'crypto';

describe('Recurrence & Timezone Engine (Milestone P2-02)', () => {
  let recurrenceService: RecurrenceService;
  const testOwnerId = randomUUID();
  let createdRuleId: string;

  beforeAll(async () => {
    recurrenceService = new RecurrenceService();

    // Create test user for foreign key constraint
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-rrule-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });
  });

  afterAll(async () => {
    await prisma.recurrenceRule.deleteMany({
      where: { ownerId: testOwnerId },
    });
    await prisma.user.deleteMany({
      where: { id: testOwnerId },
    });
  });

  describe('RRULE Validation & Parsing', () => {
    it('validates standard RFC 5545 RRULE strings', () => {
      expect(recurrenceService.validateRRule('FREQ=DAILY;INTERVAL=1')).toBe(true);
      expect(recurrenceService.validateRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(true);
      expect(recurrenceService.validateRRule('FREQ=MONTHLY;BYMONTHDAY=15')).toBe(true);
      expect(recurrenceService.validateRRule('FREQ=YEARLY;INTERVAL=1')).toBe(true);
    });

    it('rejects invalid RRULE syntax', () => {
      expect(recurrenceService.validateRRule('NOT_AN_RRULE')).toBe(false);
      expect(recurrenceService.validateRRule('FREQ=INVALID_FREQ')).toBe(false);
    });
  });

  describe('Occurrence Expansion', () => {
    it('expands daily recurrence rule within a 7-day window', () => {
      const dtstart = new Date('2026-11-01T09:00:00.000Z');
      const windowStart = new Date('2026-11-01T00:00:00.000Z');
      const windowEnd = new Date('2026-11-07T23:59:59.000Z');

      const occurrences = recurrenceService.expandOccurrences(
        'rule-daily-1',
        'FREQ=DAILY;INTERVAL=1',
        dtstart,
        'Asia/Jakarta',
        windowStart,
        windowEnd,
      );

      expect(occurrences).toHaveLength(7);
      expect(occurrences[0]!.date.toISOString()).toBe('2026-11-01T09:00:00.000Z');
      expect(occurrences[6]!.date.toISOString()).toBe('2026-11-07T09:00:00.000Z');
    });

    it('expands weekly recurrence with specific days (MO, WE, FR)', () => {
      const dtstart = new Date('2026-11-02T10:00:00.000Z'); // Monday
      const windowStart = new Date('2026-11-01T00:00:00.000Z');
      const windowEnd = new Date('2026-11-15T23:59:59.000Z'); // 2 weeks

      const occurrences = recurrenceService.expandOccurrences(
        'rule-weekly-1',
        'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        dtstart,
        'Asia/Jakarta',
        windowStart,
        windowEnd,
      );

      // 2 weeks * 3 days = 6 occurrences
      expect(occurrences).toHaveLength(6);
    });

    it('generates deterministic occurrence keys', () => {
      const date = new Date('2026-11-05T14:00:00.000Z');
      const key1 = recurrenceService.generateOccurrenceKey('rule-abc', date, 'Asia/Jakarta');
      const key2 = recurrenceService.generateOccurrenceKey('rule-abc', date, 'Asia/Jakarta');
      const keyDiffTz = recurrenceService.generateOccurrenceKey('rule-abc', date, 'UTC');

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32);
      expect(key1).not.toBe(keyDiffTz);
    });

    it('calculates next occurrence accurately', () => {
      const dtstart = new Date('2026-11-01T08:00:00.000Z');
      const afterDate = new Date('2026-11-03T09:00:00.000Z');

      const next = recurrenceService.getNextOccurrence('FREQ=DAILY;INTERVAL=1', dtstart, afterDate);

      expect(next).not.toBeNull();
      expect(next?.toISOString()).toBe('2026-11-04T08:00:00.000Z');
    });
  });

  describe('Timezone Normalization', () => {
    it('normalizes valid IANA timezones and defaults to Asia/Jakarta', () => {
      expect(recurrenceService.normalizeTimezone('Asia/Jakarta')).toBe('Asia/Jakarta');
      expect(recurrenceService.normalizeTimezone('UTC')).toBe('UTC');
      expect(recurrenceService.normalizeTimezone('America/New_York')).toBe('America/New_York');
      expect(recurrenceService.normalizeTimezone(undefined)).toBe('Asia/Jakarta');
    });

    it('throws on invalid IANA timezones', () => {
      expect(() => recurrenceService.normalizeTimezone('Fake/Timezone')).toThrow(
        'Invalid IANA timezone',
      );
    });
  });

  describe('Database RecurrenceRule CRUD', () => {
    it('creates, lists, and deletes a recurrence rule in PostgreSQL', async () => {
      const created = await recurrenceService.createRule(testOwnerId, {
        rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH',
        timezone: 'Asia/Jakarta',
        startsLocal: '2026-11-01T08:00:00.000Z',
        endsAt: '2026-12-31T23:59:59.000Z',
      });

      expect(created.data.id).toBeDefined();
      expect(created.data.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH');
      expect(created.data.timezone).toBe('Asia/Jakarta');
      createdRuleId = created.data.id;

      const list = await recurrenceService.listRules(testOwnerId);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
      expect(list.data.find((r) => r.id === createdRuleId)).toBeDefined();

      const detail = await recurrenceService.getRule(testOwnerId, createdRuleId);
      expect(detail.data.id).toBe(createdRuleId);

      const del = await recurrenceService.deleteRule(testOwnerId, createdRuleId);
      expect(del.success).toBe(true);

      await expect(recurrenceService.getRule(testOwnerId, createdRuleId)).rejects.toThrow(
        'not found',
      );
    });
  });
});
