'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { isUnauthorized, redirectToLogin, useAccount } from '../shared/SessionContext';
import { useToast } from '../shared/ToastProvider';
import { secondaryButton } from '../shared/ResourceState';

export function Header() {
  const account = useAccount();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const pending = useRef(false);

  async function signOut() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    try {
      await authApi.logout();
      redirectToLogin();
    } catch (error) {
      if (isUnauthorized(error)) {
        redirectToLogin();
      } else
        toast({ tone: 'error', message: 'Sign out could not be confirmed. Please try again.' });
    } finally {
      pending.current = false;
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 w-full flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <Link
        href="/"
        className="rounded-md text-base font-semibold tracking-tight text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
      >
        Personal workspace
      </Link>
      <nav aria-label="Account" className="flex min-w-0 items-center gap-3">
        {account ? (
          <>
            <Link
              href="/settings#account"
              className="max-w-48 truncate rounded-md py-2 text-sm text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
              aria-label={`Account settings for ${account.email}`}
            >
              <span className="hidden sm:inline">{account.email}</span>
              <span className="sm:hidden">Account</span>
            </Link>
            <button
              type="button"
              className={secondaryButton}
              disabled={signingOut}
              onClick={signOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <Link href="/login" className={secondaryButton}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
