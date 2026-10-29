'use client';

import React, { useState } from 'react';

export interface CalendarEventItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  source: 'local' | 'google';
  externalEventId?: string | null;
  hasMeeting?: boolean;
}

const mockEvents: CalendarEventItem[] = [
  {
    id: 'cal-event-1',
    title: 'Review Bab V Laporan KP',
    startsAt: '2026-11-02T09:00:00.000Z',
    endsAt: '2026-11-02T10:00:00.000Z',
    timezone: 'Asia/Jakarta',
    source: 'local',
  },
  {
    id: 'cal-event-2',
    title: 'Google Meet Sync Session',
    startsAt: '2026-11-02T13:00:00.000Z',
    endsAt: '2026-11-02T14:00:00.000Z',
    timezone: 'Asia/Jakarta',
    source: 'google',
    externalEventId: 'g_event_123',
    hasMeeting: true,
  },
];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventItem[]>(mockEvents);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'google'>('all');

  const filteredEvents = events.filter((e) => {
    if (sourceFilter === 'all') return true;
    return e.source === sourceFilter;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startsAt || !endsAt) return;

    const newEvent: CalendarEventItem = {
      id: `local-ev-${Date.now()}`,
      title,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      timezone: 'Asia/Jakarta',
      source: 'local',
    };

    setEvents((prev) => [...prev, newEvent]);
    setTitle('');
    setStartsAt('');
    setEndsAt('');
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Calendar & Agenda</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Two-way Google Calendar synchronization, conflict detection, and local scheduling
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
        >
          + Add Event
        </button>
      </div>

      {/* Filter and sync controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-muted">Source:</span>
          {(['all', 'local', 'google'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(s)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                sourceFilter === s
                  ? 'bg-action-primary/15 text-action-primary font-semibold'
                  : 'text-text-muted hover:bg-surface-subtle hover:text-text-primary'
              }`}
            >
              {s === 'all' ? 'All Events' : `${s} calendar`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
            Google Sync: Active (Incremental)
          </span>
        </div>
      </div>

      {/* Event list view */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="border-b border-border p-4 bg-surface-subtle/50">
          <h3 className="text-sm font-bold text-text-primary">Upcoming Agenda Timeline</h3>
        </div>

        <div className="divide-y divide-border">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              No calendar events found for this filter
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-surface-subtle/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary text-sm">{event.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                        event.source === 'google'
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                          : 'border-border bg-surface-subtle text-text-muted'
                      }`}
                    >
                      {event.source}
                    </span>
                    {event.hasMeeting && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                        📹 Video Call
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {new Date(event.startsAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}{' '}
                    -{' '}
                    {new Date(event.endsAt).toLocaleTimeString('id-ID', {
                      timeStyle: 'short',
                    })}{' '}
                    ({event.timezone})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">
                    Confirmed
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Add Event */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-text-primary">Add Calendar Event</h3>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bimbingan Kerja Praktek"
                  className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:border-action-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-action-primary px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
