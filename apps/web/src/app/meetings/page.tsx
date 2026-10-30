'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { meetingsApi } from '@/lib/api';
import { useToast } from '@/components/shared/ToastProvider';
import {
  DEFAULT_MEETING_TIMEZONE, fromMeetingInput, toMeetingInput,
  formatMeetingInstant, isHttpsMeetingLink, meetingStatusLabel,
} from '@/lib/meeting-time';

export interface MeetingItem {
  id: string;
  provider: 'google-meet' | 'zoom';
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'provisioning' | 'confirmed' | 'failed' | 'unknown';
  linkProvenance?: 'user-provided' | 'unverified' | 'none';
  joinUrl?: string | null;
  externalMeetingId?: string | null;
  calendarEvent?: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
  } | null;
}

export default function MeetingsPage() {
  const show = useToast();
  const [timezone, setTimezone] = useState(DEFAULT_MEETING_TIMEZONE);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null);

  const [provider, setProvider] = useState<'google-meet' | 'zoom'>('google-meet');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [joinUrlInput, setJoinUrlInput] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await meetingsApi.list();
      const mapped = (res.data || []).map((m: any) => ({
        id: m.id,
        provider: m.provider,
        title: m.calendarEvent?.title || 'Video Meeting',
        startsAt: m.calendarEvent?.startsAt || '',
        endsAt: m.calendarEvent?.endsAt || '',
        timezone: m.calendarEvent?.timezone || DEFAULT_MEETING_TIMEZONE,
        status: m.provisioningStatus || m.status || 'unknown',
        linkProvenance: m.linkProvenance,
        joinUrl: m.joinUrl,
        externalMeetingId: m.externalMeetingId,
        calendarEvent: m.calendarEvent,
      }));
      setMeetings(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch meetings from database';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (!title.trim()) throw new Error('Enter a meeting title');
      // Preserve exact persisted instants (including seconds) on an unchanged edit.
      const start = editingMeeting && startsAt === toMeetingInput(editingMeeting.startsAt, timezone)
        ? editingMeeting.startsAt : fromMeetingInput(startsAt, timezone);
      const end = editingMeeting && endsAt === toMeetingInput(editingMeeting.endsAt, timezone)
        ? editingMeeting.endsAt : fromMeetingInput(endsAt, timezone);
      if (new Date(start) >= new Date(end)) throw new Error('Start time must be before end time');
      const linkChanged = !editingMeeting || joinUrlInput !== (editingMeeting.joinUrl || '');
      if (linkChanged && joinUrlInput && !isHttpsMeetingLink(joinUrlInput)) throw new Error('Enter a valid HTTPS meeting link without credentials or whitespace');
      if (editingMeeting?.joinUrl && !joinUrlInput) throw new Error('Enter a replacement HTTPS link; clearing a saved link is not supported');
      const data = {
        title: title.trim(), startsAt: start, endsAt: end, timezone,
        joinUrl: linkChanged ? joinUrlInput || undefined : undefined,
      };
      if (editingMeeting) {
        await meetingsApi.update(editingMeeting.id, data);
      } else {
        await meetingsApi.create({ provider, ...data });
      }

      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setJoinUrlInput('');
      setEditingMeeting(null);
      setIsDialogOpen(false);
      await fetchMeetings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan meeting';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Delete this local meeting? This does not cancel a meeting with Google or Zoom.')) return;
    try {
      await meetingsApi.delete(id);
      await fetchMeetings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete meeting';
      show({ message: msg, tone: 'error' });
    }
  };

  const openEditModal = (meeting: MeetingItem) => {
    try {
      const start = toMeetingInput(meeting.startsAt, meeting.timezone);
      const end = toMeetingInput(meeting.endsAt, meeting.timezone);
      setEditingMeeting(meeting);
      setProvider(meeting.provider);
      setTitle(meeting.title);
      setTimezone(meeting.timezone);
      setStartsAt(start);
      setEndsAt(end);
      setJoinUrlInput(meeting.joinUrl || '');
      setFormError(null);
      setIsDialogOpen(true);
    } catch {
      show({ message: 'This meeting has an invalid schedule or timezone and cannot be edited here', tone: 'error' });
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (filterProvider === 'all') return true;
    return m.provider === filterProvider;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Meetings (Google Meet & Zoom)
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Save your meeting link locally. Provider-generated links require a connected provider;
            a saved link does not verify a Google Meet or Zoom conference.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingMeeting(null);
            setProvider('google-meet');
            setTitle('');
            setStartsAt('');
            setEndsAt('');
            setTimezone(DEFAULT_MEETING_TIMEZONE);
            setJoinUrlInput('');
            setFormError(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
        >
          + Schedule Meeting
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Database connection notice: {error}</span>
          <button
            type="button"
            onClick={fetchMeetings}
            className="rounded bg-destructive/20 px-2 py-1 text-xs font-semibold hover:bg-destructive/30"
          >
            Retry
          </button>
        </div>
      )}

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
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">
          Loading meetings from PostgreSQL database...
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-text-muted">
          No meetings found in database. Click "+ Schedule Meeting" above to provision Google Meet
          or Zoom.
        </div>
      ) : (
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

                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${
                    meeting.status === 'failed'
                      ? 'border-destructive/30 bg-destructive/10 text-destructive'
                      : 'border-border bg-surface-subtle text-text-secondary'
                  }`}>
                    {meetingStatusLabel(meeting.status, meeting.joinUrl)}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-semibold text-text-primary">{meeting.title}</h3>

                <div className="mt-2 space-y-1 text-xs text-text-secondary">
                  <div>
                    {formatMeetingInstant(meeting.startsAt, meeting.timezone)}
                    {' — '}
                    {formatMeetingInstant(meeting.endsAt, meeting.timezone)}
                  </div>
                  <div className="text-[11px] text-text-muted">Timezone: {meeting.timezone}</div>
                  {meeting.joinUrl && (
                    <p className="text-xs text-text-muted">
                      {meeting.linkProvenance === 'user-provided' ? 'User-provided link' : 'Link provenance unverified'}
                      {' · No provider verification'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  {meeting.status === 'confirmed' && isHttpsMeetingLink(meeting.joinUrl) && (
                    <a
                      href={meeting.joinUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-md bg-action-primary px-3 text-xs font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm transition-colors"
                    >
                      Join Meeting &rarr;
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(meeting)}
                    className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMeeting(meeting.id)}
                    className="rounded border border-border bg-surface px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Schedule/Edit Meeting */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-text-primary">
                {editingMeeting ? 'Edit Meeting' : 'Schedule Video Conference'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
                aria-label="Close meeting dialog"
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >Close</button>
            </div>

            <form onSubmit={handleSaveMeeting} className="mt-4 space-y-4">
              <p className="text-sm text-text-secondary">All date/time fields use {timezone}.</p>
              {formError && <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{formError}</p>}
              {!editingMeeting && (
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
              )}

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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Custom Meeting Link / URL (Optional)
                </label>
                <input
                  type="url"
                  value={joinUrlInput}
                  onChange={(e) => setJoinUrlInput(e.target.value)}
                  placeholder="e.g. https://meet.google.com/xxx-yyyy-zzz or https://zoom.us/j/123456789"
                  className="mt-1 w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-action-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  {editingMeeting ? 'Saved exactly as entered. Links are not verified with the provider.' : 'Leave empty to request provider provisioning (requires a connected provider). A custom HTTPS link is saved locally, not provider verified.'}
                </p>
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
                  disabled={isSubmitting}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-action-primary px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-primary-hover shadow-sm disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingMeeting
                      ? 'Update Meeting'
                      : joinUrlInput ? 'Save Meeting Link' : 'Request Provider Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
