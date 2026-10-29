import React from 'react';

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Meetings (Google Meet & Zoom)
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Asynchronous meeting provisioning state machines (Phase 2 MVP)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle border border-border text-lg">
          🎥
        </div>
        <h3 className="mt-4 text-base font-semibold text-text-primary">
          Meeting Adapters Ready for Phase 2
        </h3>
        <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
          Meeting provisioning state machine (requested &rarr; provisioning &rarr; confirmed) is
          designed. Provider adapters for Google Meet and Zoom will be connected in Milestone P2-04.
        </p>
      </div>
    </div>
  );
}
