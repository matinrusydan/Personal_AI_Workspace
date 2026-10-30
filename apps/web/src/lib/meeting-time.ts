export const DEFAULT_MEETING_TIMEZONE = 'Asia/Jakarta';

function formatter(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}

function wallParts(date: Date, timezone: string) {
  return Object.fromEntries(formatter(timezone).formatToParts(date).map(({ type, value }) => [type, value]));
}

/** Render an instant in the event's zone, never the browser's implicit timezone. */
export function toMeetingInput(instant: string, timezone = DEFAULT_MEETING_TIMEZONE): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid meeting timestamp');
  const p = wallParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Reject DST gaps/overlaps instead of guessing which instant the owner intended. */
export function fromMeetingInput(local: string, timezone = DEFAULT_MEETING_TIMEZONE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error('Enter a valid date and time');
  const [, y, m, d, h, min] = match;
  const nominal = new Date(`${y}-${m}-${d}T${h}:${min}:00.000Z`);
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 16) !== local) {
    throw new Error('Enter a valid date and time');
  }
  const candidates = new Set<string>();
  // Sample both sides of nearby transitions, including half-hour and full-day shifts.
  for (let hours = -36; hours <= 36; hours += 12) {
    const sample = new Date(nominal.getTime() + hours * 3600000);
    const p = wallParts(sample, timezone);
    const wall = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`);
    const candidate = new Date(nominal.getTime() - (wall.getTime() - sample.getTime())).toISOString();
    if (toMeetingInput(candidate, timezone) === local) candidates.add(candidate);
  }
  if (candidates.size !== 1) {
    throw new Error(candidates.size ? 'Ambiguous local time during a timezone transition; choose another time' : 'This local time does not exist in the selected timezone');
  }
  return [...candidates][0]!;
}

export const toJakartaInput = (instant: string) => toMeetingInput(instant);
export const fromJakartaInput = (local: string) => fromMeetingInput(local);

export function formatMeetingInstant(instant: string, timezone: string): string {
  try {
    const date = new Date(instant);
    if (!instant || !Number.isFinite(date.getTime())) return 'Schedule unavailable';
    return date.toLocaleString('id-ID', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return 'Invalid schedule or timezone';
  }
}

export function isHttpsMeetingLink(value: string | null | undefined): boolean {
  if (!value || value !== value.trim() || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function meetingStatusLabel(status: string, joinUrl?: string | null): string {
  if (status === 'failed') return 'Provisioning failed';
  if (status === 'provisioning') return 'Provisioning pending';
  if (status === 'confirmed') return joinUrl ? 'Link saved — not provider verified' : 'No verified meeting link';
  return 'Status unknown';
}
