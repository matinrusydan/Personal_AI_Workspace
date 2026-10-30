'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import {
  SessionContext,
  isUnauthorized,
  readAccount,
  loginRedirectPath,
  redirectToLogin,
  type WorkspaceAccount,
} from '../shared/SessionContext';
import { ToastProvider } from '../shared/ToastProvider';
import { secondaryButton } from '../shared/ResourceState';

type SessionState =
  | { status: 'checking' | 'error' | 'unauthorized' }
  | { status: 'authenticated'; account: WorkspaceAccount };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicRoute = pathname === '/login' || pathname === '/setup';
  const [session, setSession] = useState<SessionState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (publicRoute) {
      setSession({ status: 'checking' });
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    setSession({ status: 'checking' });
    const redirect = () => {
      if (disposed) return;
      disposed = true;
      controller.abort();
      setSession({ status: 'unauthorized' });
      redirectToLogin(pathname);
    };
    window.addEventListener('paw:unauthorized', redirect);
    apiRequest('/me', { signal: controller.signal })
      .then((response: unknown) => {
        const account = readAccount(response);
        if (!disposed) setSession({ status: 'authenticated', account });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          if (isUnauthorized(error)) redirect();
          else setSession({ status: 'error' });
        }
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('paw:unauthorized', redirect);
    };
  }, [publicRoute, pathname, attempt]);

  return (
    <ToastProvider>
      {publicRoute ? (
        children
      ) : session.status !== 'authenticated' ? (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 text-text-primary">
          <h1 className="text-xl font-semibold">Personal workspace</h1>
          {session.status === 'error' ? (
            <div role="alert" className="space-y-4">
              <p className="text-sm text-text-secondary">
                Your session could not be verified. Protected data has not been loaded.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className={secondaryButton}
                >
                  Try again
                </button>
                <Link href="/login" className={secondaryButton}>
                  Go to sign in
                </Link>
              </div>
            </div>
          ) : session.status === 'unauthorized' ? (
            <div role="status" className="space-y-4 text-sm text-text-secondary">
              <p>Redirecting to sign in…</p>
              <a href={loginRedirectPath(pathname)} className={secondaryButton}>
                Go to sign in
              </a>
            </div>
          ) : (
            <p role="status" className="text-sm text-text-secondary">
              Verifying your session…
            </p>
          )}
        </main>
      ) : (
        <SessionContext.Provider value={session.account}>
          <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
            <a
              href="#workspace-content"
              className="sr-only focus:not-sr-only focus:p-4 focus:bg-surface"
            >
              Skip to content
            </a>
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main
                id="workspace-content"
                tabIndex={-1}
                className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 pb-28 sm:p-6 md:pb-6"
              >
                {children}
              </main>
            </div>
            <BottomNav />
          </div>
        </SessionContext.Provider>
      )}
    </ToastProvider>
  );
}
