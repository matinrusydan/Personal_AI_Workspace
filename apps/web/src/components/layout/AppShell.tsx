'use client';

import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 pb-20 sm:p-6 md:pb-6 max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
