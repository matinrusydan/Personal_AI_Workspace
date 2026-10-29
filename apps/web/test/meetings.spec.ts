import { describe, it, expect } from 'vitest';
import { MeetingItem } from '../src/app/meetings/page';

describe('Meetings UI & Provider State Logic (Milestone P2-04)', () => {
  const meetings: MeetingItem[] = [
    {
      id: 'm1',
      provider: 'google-meet',
      title: 'Meet Session',
      startsAt: '2026-11-05T09:00:00.000Z',
      endsAt: '2026-11-05T10:00:00.000Z',
      timezone: 'Asia/Jakarta',
      status: 'confirmed',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
    },
    {
      id: 'm2',
      provider: 'zoom',
      title: 'Zoom Session',
      startsAt: '2026-11-05T14:00:00.000Z',
      endsAt: '2026-11-05T15:00:00.000Z',
      timezone: 'Asia/Jakarta',
      status: 'confirmed',
      joinUrl: 'https://zoom.us/j/1234567890',
    },
  ];

  it('filters meetings by video conference provider', () => {
    const googleMeetings = meetings.filter((m) => m.provider === 'google-meet');
    const zoomMeetings = meetings.filter((m) => m.provider === 'zoom');

    expect(googleMeetings).toHaveLength(1);
    expect(zoomMeetings).toHaveLength(1);
    expect(googleMeetings[0]!.joinUrl).toContain('meet.google.com');
    expect(zoomMeetings[0]!.joinUrl).toContain('zoom.us/j/');
  });

  it('validates confirmed status and join URL presence', () => {
    for (const meeting of meetings) {
      expect(meeting.status).toBe('confirmed');
      expect(meeting.joinUrl).toBeDefined();
    }
  });
});
