export interface AgendaEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: string;
}
export interface DueTask {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  priority?: string;
}
export interface UpcomingMeeting {
  id: string;
  provider: string;
  provisioningStatus: string;
  calendarEvent: AgendaEvent | null;
}

export function dayKey(value: string | number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function todaysAgenda(events: AgendaEvent[], now: number, timezone: string) {
  const today = dayKey(now, timezone);
  return events
    .filter(
      (event) =>
        event.status !== 'cancelled' &&
        event.status !== 'canceled' &&
        Number.isFinite(Date.parse(event.startsAt)) &&
        Number.isFinite(Date.parse(event.endsAt)) &&
        dayKey(event.startsAt, timezone) <= today &&
        dayKey(Date.parse(event.endsAt) - 1, timezone) >= today,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function dueTasks(tasks: DueTask[], now: number) {
  const through = now + 7 * 24 * 60 * 60 * 1000;
  return tasks
    .filter(
      (task) =>
        !['done', 'completed', 'cancelled', 'canceled'].includes(task.status) &&
        task.dueAt &&
        Date.parse(task.dueAt) <= through,
    )
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
}

export function upcomingMeetings(meetings: UpcomingMeeting[], now: number) {
  return meetings
    .filter(
      (meeting) =>
        meeting.calendarEvent &&
        !['cancelled', 'canceled'].includes(meeting.provisioningStatus) &&
        Date.parse(meeting.calendarEvent.endsAt) > now,
    )
    .sort((a, b) => Date.parse(a.calendarEvent!.startsAt) - Date.parse(b.calendarEvent!.startsAt));
}

export function displayDate(value: string, timezone: string, date = true) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    ...(date ? ({ day: 'numeric', month: 'short' } as const) : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}
