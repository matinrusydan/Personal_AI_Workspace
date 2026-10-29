import React from 'react';
import Link from 'next/link';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Welcome back, Owner</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Personal AI Workspace &bull; Core platform running independently on local PostgreSQL &
          BullMQ
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href="/meetings"
            className="inline-flex h-9 items-center justify-center rounded-md bg-action-primary px-3 text-xs font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
          >
            + Create Meeting (Meet/Zoom)
          </Link>
          <Link
            href="/tasks"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-subtle px-3 text-xs font-medium text-text-primary hover:bg-surface transition-colors"
          >
            + New Task
          </Link>
        </div>
      </div>

      {/* KPI & Status Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Today's Agenda</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">0 Meetings</div>
          <div className="mt-1 text-xs text-text-muted">Google Meet & Zoom integrated</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Active Tasks</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">0 Pending</div>
          <div className="mt-1 text-xs text-text-muted">Database ready for Phase 2</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">iPhone 12 Alarms</div>
          <div className="mt-2 flex items-center gap-2 text-base font-bold text-success">
            <span className="h-2.5 w-2.5 rounded-full bg-success"></span>
            AlarmKit Ready
          </div>
          <div className="mt-1 text-xs text-text-muted">iOS 26.4.1 physical verified</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-text-muted">Core Reliability</div>
          <div className="mt-2 flex items-center gap-2 text-base font-bold text-action-primary">
            <span className="h-2.5 w-2.5 rounded-full bg-action-primary"></span>
            100% Outbox Sync
          </div>
          <div className="mt-1 text-xs text-text-muted">PostgreSQL 16 & BullMQ active</div>
        </div>
      </div>

      {/* Architectural Checklist Card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text-primary">Phase 1 Architecture Status</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success font-bold">✔</span> P1-01 Monorepo & OpenAPI Contracts
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success font-bold">✔</span> P1-02 Hybrid MFA (TOTP RFC 6238),
            Sessions, Devices & Audit
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success font-bold">✔</span> P1-03 PostgreSQL 16 Migrations
            (paw_dev), Redis & BullMQ Outbox
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success font-bold">✔</span> P1-04 Next.js App Router Web Shell &
            Semantic Theme Engine
          </div>
        </div>
      </div>
    </div>
  );
}
