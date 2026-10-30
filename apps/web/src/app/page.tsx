'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { calendarApi, meetingsApi, tasksApi } from '@/lib/api';
import { useAccount } from '@/components/shared/SessionContext';
import {
  ResourceNotice,
  readList,
  secondaryButton,
  primaryButton,
  useResource,
} from '@/components/shared/ResourceState';
import {
  displayDate,
  dueTasks,
  todaysAgenda,
  upcomingMeetings,
  type AgendaEvent,
  type DueTask,
  type UpcomingMeeting,
} from '@/components/shared/agenda';

const loadTasks = async () => readList<DueTask>(await tasksApi.list());
const loadMeetings = async () => readList<UpcomingMeeting>(await meetingsApi.list());

export default function OverviewPage() {
  const account = useAccount();
  const timezone = account?.timezone ?? 'Asia/Jakarta';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const loadAgenda = useCallback(async () => {
    const at = Date.now();
    // A padded UTC window includes today's events in any IANA timezone.
    return readList<AgendaEvent>(
      await calendarApi.list(
        new Date(at - 36 * 3600000).toISOString(),
        new Date(at + 36 * 3600000).toISOString(),
      ),
    );
    // Refresh the range when the account's local calendar day changes.
  }, [today]);
  const agenda = useResource(loadAgenda);
  const tasks = useResource(loadTasks);
  const meetings = useResource(loadMeetings);
  const events =
    agenda.state.status === 'success' ? todaysAgenda(agenda.state.data, now, timezone) : [];
  const due = tasks.state.status === 'success' ? dueTasks(tasks.state.data, now) : [];
  const upcoming =
    meetings.state.status === 'success' ? upcomingMeetings(meetings.state.data, now) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">
            {new Intl.DateTimeFormat('en-GB', {
              timeZone: timezone,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(now)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
            Your day, at a glance
          </h1>
          <p className="mt-2 text-sm text-text-secondary">Agenda and deadlines · {timezone}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tasks" className={primaryButton}>
            Manage tasks
          </Link>
          <Link href="/calendar" className={secondaryButton}>
            Open calendar
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="agenda-title"
          className="rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="agenda-title" className="text-base font-semibold">
              Today's agenda
            </h2>
            <button
              type="button"
              onClick={agenda.retry}
              disabled={agenda.state.status === 'loading'}
              className="min-h-touch rounded-md px-2 text-sm text-action-primary disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
            >
              Refresh<span className="sr-only"> agenda</span>
            </button>
          </div>
          {agenda.state.status !== 'success' ? (
            <ResourceNotice
              status={agenda.state.status}
              noun="today's agenda"
              onRetry={agenda.retry}
            />
          ) : events.length === 0 ? (
            <p className="py-6 text-sm text-text-secondary">
              No calendar events scheduled for today.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event) => (
                <li key={event.id} className="py-4">
                  <p className="text-xs font-medium text-text-secondary">
                    <time dateTime={event.startsAt}>
                      {displayDate(event.startsAt, timezone, false)}
                    </time>{' '}
                    –{' '}
                    <time dateTime={event.endsAt}>
                      {displayDate(event.endsAt, timezone, false)}
                    </time>
                  </p>
                  <Link
                    href="/calendar"
                    className="mt-1 block break-words text-sm font-medium text-text-primary hover:underline"
                  >
                    {event.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="due-title"
          className="rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="due-title" className="text-base font-semibold">
                Due tasks
              </h2>
              <p className="mt-1 text-xs text-text-secondary">Overdue and due in the next 7 days</p>
            </div>
            <Link
              href="/tasks"
              className="min-h-touch rounded-md px-2 py-3 text-sm text-action-primary"
            >
              View all<span className="sr-only"> tasks</span>
            </Link>
          </div>
          {tasks.state.status !== 'success' ? (
            <ResourceNotice status={tasks.state.status} noun="due tasks" onRetry={tasks.retry} />
          ) : due.length === 0 ? (
            <p className="py-6 text-sm text-text-secondary">No open tasks due in this period.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {due.slice(0, 6).map((task) => (
                  <li key={task.id} className="py-4">
                    <Link href="/tasks" className="break-words text-sm font-medium hover:underline">
                      {task.title}
                    </Link>
                    <p className="mt-1 text-xs text-text-secondary">
                      {Date.parse(task.dueAt!) < now ? 'Overdue · ' : 'Due · '}
                      <time dateTime={task.dueAt!}>{displayDate(task.dueAt!, timezone)}</time>
                    </p>
                  </li>
                ))}
              </ul>
              {due.length > 6 ? (
                <p className="mt-3 text-xs text-text-secondary">
                  Showing 6 of {due.length} due tasks. Open Tasks for the full list.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section
        aria-labelledby="upcoming-title"
        className="rounded-xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="upcoming-title" className="text-base font-semibold">
              Upcoming meetings
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Meeting records do not verify provider connectivity.
            </p>
          </div>
          <Link href="/meetings" className={secondaryButton}>
            Manage meetings
          </Link>
        </div>
        {meetings.state.status !== 'success' ? (
          <ResourceNotice
            status={meetings.state.status}
            noun="upcoming meetings"
            onRetry={meetings.retry}
          />
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-sm text-text-secondary">No upcoming meetings.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.slice(0, 5).map((meeting) => (
              <li
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <Link
                    href="/meetings"
                    className="break-words text-sm font-medium hover:underline"
                  >
                    {meeting.calendarEvent!.title}
                  </Link>
                  <p className="mt-1 text-xs text-text-secondary">
                    <time dateTime={meeting.calendarEvent!.startsAt}>
                      {displayDate(meeting.calendarEvent!.startsAt, timezone)}
                    </time>{' '}
                    · {meeting.provider}
                  </p>
                </div>
                <span className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary">
                  Provisioning: {meeting.provisioningStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
