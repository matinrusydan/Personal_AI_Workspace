'use client';

import React, { useState } from 'react';

export interface MeetingItem {
  id: string;
  provider: 'google-meet' | 'zoom';
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'provisioning' | 'confirmed' | 'failed';
  joinUrl?: string | null;
  externalMeetingId?: string | null;
}

const initialMeetings: MeetingItem[] = [
  {
    id: 'meet-demo-1',
    provider: 'google-meet',
    title: 'Evaluasi Mingguan Proyek',
    startsAt: '2026-11-05T09:00:00.000Z',
    endsAt: '2026-11-05T10:00:00.000Z',
    timezone: 'Asia/Jakarta',
    status: 'confirmed',
    joinUrl: 'https://meet.google.com/abc-defg-hij',
    externalMeetingId: 'abc-defg-hij',
  },
  {
    id: 'meet-demo-2',
    provider: 'zoom',
    title: 'Konsultasi Teknis & Code Review',
    startsAt: '2026-11-05T13:30:00.000Z',
    endsAt: '2026-11-05T14:30:00.000Z',
    timezone: 'Asia/Jakarta',
    status: 'confirmed',
    joinUrl: 'https://zoom.us/j/8492049182',
    externalMeetingId: '8492049182',
  },
];

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingItem[]>(initialMeetings);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [provider, setProvider] = useState<'google-meet' | 'zoom'>('google-meet');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');

  const filteredMeetings = meetings.filter((m) => {
    if (filterProvider === 'all') return true;
    return m.provider === filterProvider;
  });

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startsAt || !endsAt) return;

    const newMeetingId = `meet-${Date.now()}`;
    const generatedUrl =
      provider === 'google-meet'
        ? `https://meet.google.com/gmt-${Math.random().toString(36).substring(2, 6)}`
        : `https://zoom.us/j/${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const newMeeting: MeetingItem = {
      id: newMeetingId,
      provider,
      title,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      timezone: 'Asia/Jakarta',
      status: 'confirmed',
      joinUrl: generatedUrl,
    };

    setMeetings((prev) => [newMeeting, ...prev]);
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
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Meetings (Google Meet & Zoom)
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Provision video conferences with automatic calendar sync & reminder schedule (Phase 2
            MVP)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
        >
          + Schedule Meeting
        </button>
      </div>

      {/* Provider Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-muted">Filter:</span>
          {(['all', 'google-meet', 'zoom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilterProvider(p)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterProvider === p
                  ? 'bg-action-primary/15 text-action-primary font-semibold'
                  : 'text-text-muted hover:bg-surface-subtle hover:text-text-primary'
              }`}
            >
              {p === 'all' ? 'All Providers' : p === 'google-meet' ? 'Google Meet' : 'Zoom'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-500 border border-blue-500/20">
            Google Meet P0
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-blue-600/10 px-2 py-0.5 font-medium text-blue-600 border border-blue-600/20">
            Zoom P0
          </span>
        </div>
      </div>

      {/* Meetings List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredMeetings.map((meeting) => (
          <div
            key={meeting.id}
            className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-action-primary/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold border ${
                    meeting.provider === 'google-meet'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {meeting.provider === 'google-meet' ? 'Google Meet' : 'Zoom'}
                </span>

                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success border border-success/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {meeting.status}
                </span>
              </div>

              <h3 className="mt-3 text-base font-semibold text-text-primary">{meeting.title}</h3>

              <div className="mt-2 space-y-1 text-xs text-text-secondary">
                <div>
                  📅{' '}
                  {new Date(meeting.startsAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  -{' '}
                  {new Date(meeting.endsAt).toLocaleTimeString('id-ID', {
                    timeStyle: 'short',
                  })}
                </div>
                <div className="text-[11px] text-text-muted">Timezone: {meeting.timezone}</div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between">
              <span className="text-xs text-text-muted font-mono truncate max-w-[180px]">
                {meeting.joinUrl}
              </span>

              {meeting.joinUrl && (
                <a
                  href={meeting.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center rounded-md bg-action-primary px-3 text-xs font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm transition-colors"
                >
                  Join Meeting &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Schedule Meeting */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-text-primary">Schedule Video Conference</h3>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Provider *
                </label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('google-meet')}
                    className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                      provider === 'google-meet'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500'
                        : 'border-border bg-surface-subtle text-text-secondary hover:bg-surface'
                    }`}
                  >
                    Google Meet
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('zoom')}
                    className={`flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                      provider === 'zoom'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500 ring-1 ring-blue-500'
                        : 'border-border bg-surface-subtle text-text-secondary hover:bg-surface'
                    }`}
                  >
                    Zoom Meeting
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sesi Diskusi Kerja Praktek"
                  className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Starts At *
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
                    Ends At *
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
                  Provision Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
