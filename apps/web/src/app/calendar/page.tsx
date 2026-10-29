import React from 'react';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Calendar & Agenda</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Two-way Google Calendar synchronization and local scheduling (Phase 2)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle border border-border text-lg">
          📅
        </div>
        <h3 className="mt-4 text-base font-semibold text-text-primary">
          Calendar View Ready for Phase 2
        </h3>
        <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
          Database models and OpenAPI contracts are established. Two-way Google Calendar
          synchronization will be implemented in Milestone P2-03.
        </p>
      </div>
    </div>
  );
}
