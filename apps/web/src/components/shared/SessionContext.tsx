'use client';

import { createContext, useContext } from 'react';

export interface WorkspaceAccount {
  id: string;
  email: string;
  timezone: string;
}

export const SessionContext = createContext<WorkspaceAccount | null>(null);

export function useAccount() {
  return useContext(SessionContext);
}

export function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 401;
}

export function loginRedirectPath(pathname = '/'): string {
  const target = pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('\\')
    ? pathname
    : '/';
  return `/login?redirect=${encodeURIComponent(target)}`;
}

export function redirectToLogin(pathname = '/') {
  if (typeof window !== 'undefined') window.location.replace(loginRedirectPath(pathname));
}

export function notifyUnauthorized(error: unknown) {
  if (isUnauthorized(error) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('paw:unauthorized'));
  }
}

export function readAccount(value: unknown): WorkspaceAccount {
  const account = (value as { data?: Partial<WorkspaceAccount> } | null)?.data;
  if (!account?.id || !account.email || !account.timezone) {
    throw new Error('Account response is incomplete');
  }
  // Validate the server timezone before using it to format dates.
  new Intl.DateTimeFormat('en', { timeZone: account.timezone }).format();
  return account as WorkspaceAccount;
}
