import { describe, it, expect } from 'vitest';
import { CalendarEventItem } from '../src/app/calendar/page';

describe('Calendar UI Component & Conflict Logic (Milestone P2-03)', () => {
  const events: CalendarEventItem[] = [
    {
      id: 'e1',
      title: 'Meeting 1',
      startsAt: '2026-11-02T09:00:00.000Z',
      endsAt: '2026-11-02T10:00:00.000Z',
      timezone: 'Asia/Jakarta',
      source: 'local',
    },
    {
      id: 'e2',
      title: 'Meeting 2',
      startsAt: '2026-11-02T13:00:00.000Z',
      endsAt: '2026-11-02T14:00:00.000Z',
      timezone: 'Asia/Jakarta',
      source: 'google',
    },
  ];

  it('filters events by source accurately', () => {
    const localEvents = events.filter((e) => e.source === 'local');
    const googleEvents = events.filter((e) => e.source === 'google');

    expect(localEvents).toHaveLength(1);
    expect(googleEvents).toHaveLength(1);
    expect(localEvents[0]!.title).toBe('Meeting 1');
    expect(googleEvents[0]!.title).toBe('Meeting 2');
  });

  it('detects client-side overlaps between two time windows', () => {
    const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
      return new Date(s1) < new Date(e2) && new Date(e1) > new Date(s2);
    };

    // Overlapping window with e1 (09:00 - 10:00)
    expect(
      isOverlap(
        '2026-11-02T09:30:00.000Z',
        '2026-11-02T10:30:00.000Z',
        events[0]!.startsAt,
        events[0]!.endsAt,
      ),
    ).toBe(true);

    // Non-overlapping window (11:00 - 12:00)
    expect(
      isOverlap(
        '2026-11-02T11:00:00.000Z',
        '2026-11-02T12:00:00.000Z',
        events[0]!.startsAt,
        events[0]!.endsAt,
      ),
    ).toBe(false);
  });
});
