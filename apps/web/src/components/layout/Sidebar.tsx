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
    <aside className="hidden shrink-0 flex-col border-r border-border bg-surface md:flex md:w-56">
      <nav aria-label="Workspace" className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const current =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-touch items-center rounded-md px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing ${current ? 'bg-surface-subtle font-semibold text-action-primary' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-4 text-xs leading-relaxed text-text-secondary">
        Your schedule, tasks, and reminders in one place.
      </div>
    </aside>
  );
}
