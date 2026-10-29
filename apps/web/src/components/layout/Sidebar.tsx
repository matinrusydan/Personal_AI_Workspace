'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Overview', href: '/' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Meetings', href: '/meetings' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-surface">
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Workspace
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-action-primary/10 text-action-primary font-semibold'
                    : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4 text-xs text-text-muted">
        <div>PostgreSQL 16 &bull; BullMQ Active</div>
        <div className="mt-1 text-[11px] text-text-muted/70">Single-owner Local Mode</div>
      </div>
    </aside>
  );
}
