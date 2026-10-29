import React from 'react';

export default function RemindersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Reminders & Native iOS Alarms
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Persistent reminder rules and Apple AlarmKit physical device synchronization (Phase 3)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle border border-border text-lg">
          ⏰
        </div>
        <h3 className="mt-4 text-base font-semibold text-text-primary">
          Native Alarm Engine Ready for Phase 3
        </h3>
        <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
          Alarm acknowledgment, snooze, and device status models are established in PostgreSQL 16.
          The native SwiftUI iOS client with AlarmKit will be integrated in Phase 3.
        </p>
      </div>
    </div>
  );
}
