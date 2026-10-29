'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const mobileNavItems = [
  { label: 'Overview', href: '/' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Meetings', href: '/meetings' },
  { label: 'Settings', href: '/settings' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-2 py-1 text-xs font-medium transition-colors ${
              isActive ? 'text-action-primary font-bold' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
