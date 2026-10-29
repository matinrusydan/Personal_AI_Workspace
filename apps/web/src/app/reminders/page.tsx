'use client';

import React, { useState } from 'react';

export interface ReminderItem {
  id: string;
  title: string;
  sourceType: 'task' | 'calendar_event';
  scheduledFor: string;
  channelPolicy: 'prominent_alarm' | 'telegram' | 'default';
  status: 'scheduled' | 'fired' | 'acknowledged' | 'snoozed' | 'escalated';
  attemptVersion: number;
}

const mockReminders: ReminderItem[] = [
  {
    id: 'rem-1',
    title: 'Review Bab V Laporan KP (15m before)',
    sourceType: 'task',
    scheduledFor: '2026-11-02T08:45:00.000Z',
    channelPolicy: 'prominent_alarm',
    status: 'scheduled',
    attemptVersion: 1,
  },
  {
    id: 'rem-2',
    title: 'Google Meet Sync Session (10m before)',
    sourceType: 'calendar_event',
    scheduledFor: '2026-11-02T12:50:00.000Z',
    channelPolicy: 'prominent_alarm',
    status: 'scheduled',
    attemptVersion: 1,
  },
  {
    id: 'rem-3',
    title: 'Konsultasi Teknis & Code Review',
    sourceType: 'calendar_event',
    scheduledFor: '2026-11-01T13:20:00.000Z',
    channelPolicy: 'telegram',
    status: 'acknowledged',
    attemptVersion: 1,
  },
];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>(mockReminders);
  const [deviceSyncStatus, setDeviceSyncStatus] = useState<string>('Connected & Ready');

  const handleAcknowledge = (id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'acknowledged' } : r)));
  };

  const handleSnooze = (id: string) => {
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'snoozed',
              attemptVersion: r.attemptVersion + 1,
              scheduledFor: new Date(Date.now() + 10 * 60000).toISOString(),
            }
          : r,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Reminders & Native iOS Alarms
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Persistent reminder rules, Apple AlarmKit physical device sync, and Telegram gateway
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDeviceSyncStatus('Synced: ' + new Date().toLocaleTimeString('id-ID'))}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-subtle px-4 text-sm font-semibold text-text-primary hover:bg-surface transition-colors"
          >
            Sync Devices
          </button>
        </div>
      </div>

      {/* Device Status & Health Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">iPhone 12 Hardware</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success"></span>
            AlarmKit Active (iOS 26.4.1)
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Overrides Silent & Focus Mode</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Telegram Gateway</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold text-blue-500">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Allowlist Enforced
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Webhook Deduplication & Commands</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Device Sync State</div>
          <div className="mt-2 text-sm font-bold text-text-primary">{deviceSyncStatus}</div>
          <div className="mt-1 text-[11px] text-text-muted">
            Offline-first Acknowledgment Buffer
          </div>
        </div>
      </div>

      {/* Reminders List */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="border-b border-border p-4 bg-surface-subtle/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Scheduled Reminder Occurrences</h3>
          <span className="text-xs text-text-muted">{reminders.length} total occurrences</span>
        </div>

        <div className="divide-y divide-border">
          {reminders.map((rem) => (
            <div
              key={rem.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-surface-subtle/30 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary text-sm">{rem.title}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                      rem.channelPolicy === 'prominent_alarm'
                        ? 'border-orange-500/30 bg-orange-500/10 text-orange-500'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    {rem.channelPolicy === 'prominent_alarm' ? '🔔 iPhone Alarm' : '✈ Telegram'}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${
                      rem.status === 'acknowledged'
                        ? 'border-success/20 bg-success/10 text-success'
                        : rem.status === 'snoozed'
                          ? 'border-warning/20 bg-warning/10 text-warning'
                          : 'border-border bg-surface-subtle text-text-muted'
                    }`}
                  >
                    {rem.status}
                  </span>
                </div>

                <div className="text-xs text-text-secondary">
                  ⏰ Scheduled For:{' '}
                  {new Date(rem.scheduledFor).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {rem.attemptVersion > 1 && (
                    <span className="ml-2 text-text-muted">(Attempt #{rem.attemptVersion})</span>
                  )}
                </div>
              </div>

              {rem.status !== 'acknowledged' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSnooze(rem.id)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-secondary hover:bg-surface-subtle transition-colors"
                  >
                    Snooze 10m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(rem.id)}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-success px-3 text-xs font-semibold text-white hover:bg-success/90 shadow-sm transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
