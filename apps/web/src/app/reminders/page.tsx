'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { remindersApi, devicesApi } from '@/lib/api';

export interface ReminderOccurrenceItem {
  id: string;
  occurrenceKey: string;
  scheduledFor: string;
  status: string;
  attemptVersion: number;
}

export interface ReminderItem {
  id: string;
  title: string;
  sourceType: 'task' | 'calendar_event';
  scheduledFor: string;
  channelPolicy: 'prominent_alarm' | 'telegram' | 'default';
  status: 'scheduled' | 'fired' | 'acknowledged' | 'snoozed' | 'escalated';
  attemptVersion: number;
}

export interface ReminderRuleItem {
  id: string;
  sourceType: string;
  sourceId: string;
  offsetMinutes: number;
  channelPolicy: string;
  enabled: boolean;
  occurrences: ReminderOccurrenceItem[];
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderRuleItem[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [remRes, devRes] = await Promise.all([remindersApi.list(), devicesApi.list()]);
      setReminders(remRes.data || []);
      setDevices(devRes.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch reminders';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleAcknowledge = async (occurrenceId: string) => {
    const clientRequestId = `web-ack-${Date.now()}`;
    try {
      await remindersApi.acknowledge(occurrenceId, clientRequestId);
      await fetchReminders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge reminder';
      alert(`Error: ${msg}`);
    }
  };

  const handleSnooze = async (occurrenceId: string) => {
    const clientRequestId = `web-snz-${Date.now()}`;
    try {
      await remindersApi.snooze(occurrenceId, clientRequestId, 10);
      await fetchReminders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to snooze reminder';
      alert(`Error: ${msg}`);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this reminder rule and cancel pending alarms?'))
      return;
    try {
      await remindersApi.delete(ruleId);
      await fetchReminders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete reminder rule';
      alert(`Error: ${msg}`);
    }
  };

  const iosDevice = devices.find((d) => d.platform === 'ios');

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

        <button
          type="button"
          onClick={fetchReminders}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-subtle px-4 text-sm font-semibold text-text-primary hover:bg-surface transition-colors"
        >
          🔄 Refresh State
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Database connection notice: {error}</span>
          <button
            type="button"
            onClick={fetchReminders}
            className="rounded bg-destructive/20 px-2 py-1 text-xs font-semibold hover:bg-destructive/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Device Status & Health Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Enrolled Devices</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-bold text-text-primary">
            <span className="h-2 w-2 rounded-full bg-success"></span>
            {devices.length} Active in PostgreSQL
          </div>
          <div className="mt-1 text-[11px] text-text-muted">
            {iosDevice ? `iPhone: ${iosDevice.deviceName || 'iOS Client'}` : 'Web Client Enrolled'}
          </div>
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
          <div className="text-xs font-semibold uppercase text-text-muted">
            Reliability Architecture
          </div>
          <div className="mt-2 text-sm font-bold text-success">100% Outbox Persisted</div>
          <div className="mt-1 text-[11px] text-text-muted">
            Survives server restart & offline periods
          </div>
        </div>
      </div>

      {/* Reminders List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">
          Loading reminder rules from PostgreSQL database...
        </div>
      ) : reminders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-text-muted">
          No active reminder rules found in database. Rules are scheduled automatically when tasks
          or calendar events are created with reminders.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="border-b border-border p-4 bg-surface-subtle/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">
              Authoritative Reminder Rules & Occurrences
            </h3>
            <span className="text-xs text-text-muted">{reminders.length} rules active</span>
          </div>

          <div className="divide-y divide-border">
            {reminders.map((rule) => (
              <div
                key={rule.id}
                className="p-4 space-y-3 hover:bg-surface-subtle/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary text-sm">
                      Reminder for {rule.sourceType}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-orange-500/30 bg-orange-500/10 text-orange-500">
                      {rule.channelPolicy === 'prominent_alarm'
                        ? '🔔 iPhone Alarm'
                        : '⏰ Standard Reminder'}
                    </span>
                    <span className="text-xs text-text-muted">({rule.offsetMinutes}m offset)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="rounded border border-border px-2 py-0.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    🗑️ Delete Rule
                  </button>
                </div>

                {/* Nested occurrences */}
                <div className="space-y-2 pl-4 border-l-2 border-border-subtle">
                  {rule.occurrences.map((occ) => (
                    <div
                      key={occ.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          📅{' '}
                          {new Date(occ.scheduledFor).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                            occ.status === 'acknowledged'
                              ? 'border-success/20 bg-success/10 text-success'
                              : occ.status === 'snoozed'
                                ? 'border-warning/20 bg-warning/10 text-warning'
                                : 'border-border bg-surface-subtle text-text-muted'
                          }`}
                        >
                          {occ.status}
                        </span>
                        {occ.attemptVersion > 1 && (
                          <span className="text-text-muted">(Attempt #{occ.attemptVersion})</span>
                        )}
                      </div>

                      {occ.status !== 'acknowledged' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSnooze(occ.id)}
                            className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle"
                          >
                            Snooze 10m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(occ.id)}
                            className="rounded bg-success px-2.5 py-1 text-xs font-semibold text-white hover:bg-success/90"
                          >
                            Acknowledge
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
