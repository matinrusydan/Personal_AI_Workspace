import { BadRequestException } from '@nestjs/common';

export function validateMeetingTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException('A non-empty meeting title is required');
  }
  return value.trim();
}

export function validateMeetingTimezone(value: unknown): string {
  if (typeof value !== 'string' || !value || /^[+-]/.test(value)) {
    throw new BadRequestException('A valid IANA timezone is required');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    throw new BadRequestException('A valid IANA timezone is required');
  }
  return value;
}

/** Require an explicit offset so the API server's timezone cannot change the instant. */
export function validateMeetingInstant(value: unknown): Date {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
    : null;
  if (!match) throw new BadRequestException('Meeting dates must be ISO timestamps with an explicit offset');
  const [, y, m, d, h, min, sec, , offsetHour, offsetMinute] = match;
  const year = Number(y);
  const month = Number(m);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const instant = new Date(value as string);
  if (month < 1 || month > 12 || Number(d) < 1 || Number(d) > (days[month - 1] ?? 0)
    || Number(h) > 23 || Number(min) > 59 || Number(sec ?? 0) > 59
    || Number(offsetHour ?? 0) > 23 || Number(offsetMinute ?? 0) > 59
    || !Number.isFinite(instant.getTime())) {
    throw new BadRequestException('Invalid meeting date or time');
  }
  return instant;
}

export function validateMeetingRange(startsAt: Date, endsAt: Date): void {
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) {
    throw new BadRequestException('startsAt must be before endsAt');
  }
}

/** Validate without URL serialization: signed query strings and casing must remain exact. */
export function validateMeetingJoinUrl(value: unknown): string {
  if (typeof value !== 'string' || value !== value.trim() || /\s/.test(value)) {
    throw new BadRequestException('Meeting link must be an HTTPS URL without whitespace');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
  } catch {
    throw new BadRequestException('Meeting link must be a valid HTTPS URL without credentials');
  }
  return value;
}

/** Historical IDs are not evidence of a provider call; never infer provider verification. */
export function meetingLinkProvenance(meeting: { joinUrl: string | null; externalMeetingId: string | null }) {
  return !meeting.joinUrl ? 'none' : !meeting.externalMeetingId ? 'user-provided' : 'unverified';
}
