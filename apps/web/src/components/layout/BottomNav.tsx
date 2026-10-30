'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Overview', href: '/' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Meetings', href: '/meetings' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Settings', href: '/settings' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile workspace"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => {
        const current =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-touch items-center justify-center rounded-md px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing ${current ? 'font-semibold text-action-primary' : 'font-medium text-text-secondary hover:text-text-primary'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
