import { describe, expect, it } from 'vitest';
import {
  toJakartaInput, fromJakartaInput, toMeetingInput, fromMeetingInput,
  formatMeetingInstant, isHttpsMeetingLink, meetingStatusLabel,
} from './meeting-time';

describe('meeting wall time conversion', () => {
  it('converts Jakarta wall time to UTC and back independently of the host timezone', () => {
    expect(fromJakartaInput('2026-10-30T09:00')).toBe('2026-10-30T02:00:00.000Z');
    expect(toJakartaInput('2026-10-30T02:00:00.000Z')).toBe('2026-10-30T09:00');
  });

  it('handles midnight crossing and fractional-hour IANA offsets', () => {
    expect(toJakartaInput('2026-10-30T20:00:00Z')).toBe('2026-10-31T03:00');
    expect(fromMeetingInput('2026-10-30T09:00', 'Asia/Kathmandu')).toBe('2026-10-30T03:15:00.000Z');
    expect(toMeetingInput('2026-10-30T03:15:00Z', 'Asia/Kathmandu')).toBe('2026-10-30T09:00');
  });

  it('edits a non-Jakarta event in its persisted timezone', () => {
    const local = toMeetingInput('2026-07-01T13:00:00Z', 'America/New_York');
    expect(local).toBe('2026-07-01T09:00');
    expect(fromMeetingInput(local, 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');
  });

  it.each(['', 'invalid', '2026-02-30T09:00', '2026-13-01T09:00', '2026-10-30T24:00', '2026-10-30T09:99'])('rejects invalid wall time %s', (value) => {
    expect(() => fromJakartaInput(value)).toThrow();
  });

  it('accepts leap day only in leap years', () => {
    expect(fromJakartaInput('2028-02-29T09:00')).toBe('2028-02-29T02:00:00.000Z');
    expect(() => fromJakartaInput('2026-02-29T09:00')).toThrow();
  });

  it('rejects nonexistent and ambiguous DST wall times rather than silently shifting', () => {
    expect(() => fromMeetingInput('2026-03-08T02:30', 'America/New_York')).toThrow('does not exist');
    expect(() => fromMeetingInput('2026-11-01T01:30', 'America/New_York')).toThrow('Ambiguous');
  });

  it('rejects invalid instants and zones and displays unavailable data honestly', () => {
    expect(() => toJakartaInput('bad')).toThrow();
    expect(() => toMeetingInput('2026-10-30T02:00:00Z', 'Mars/Test')).toThrow();
    expect(formatMeetingInstant('', 'Asia/Jakarta')).toBe('Schedule unavailable');
    expect(formatMeetingInstant('2026-10-30T02:00:00Z', 'Mars/Test')).toBe('Invalid schedule or timezone');
  });

  it('displays instants using the specified zone, not the host local zone', () => {
    const instant = '2026-10-30T02:00:00Z';
    expect(formatMeetingInstant(instant, 'Asia/Jakarta')).toBe(new Date(instant).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short',
    }));
    expect(formatMeetingInstant(instant, 'Asia/Jakarta')).not.toBe(formatMeetingInstant(instant, 'America/New_York'));
  });
});

describe('meeting link and status presentation', () => {
  it('accepts an exact HTTPS link without canonicalizing signed query strings', () => {
    expect(isHttpsMeetingLink('https://Meet.Example.test/AbC?token=A%2fb%2Bz&x=1#Join')).toBe(true);
  });

  it.each([null, undefined, '', 'http://example.test', 'javascript:alert(1)', 'https://user:pass@example.test', ' https://example.test', 'https://example.test/a b'])('blocks unsafe link %s', (url) => {
    expect(isHttpsMeetingLink(url)).toBe(false);
  });

  it('does not label pending, failed, unknown or locally saved links as provider verified', () => {
    expect(meetingStatusLabel('failed', 'https://example.test')).toBe('Provisioning failed');
    expect(meetingStatusLabel('provisioning')).toBe('Provisioning pending');
    expect(meetingStatusLabel('unknown')).toBe('Status unknown');
    expect(meetingStatusLabel('confirmed', 'https://example.test')).toBe('Link saved — not provider verified');
    expect(meetingStatusLabel('confirmed')).toBe('No verified meeting link');
  });
});
