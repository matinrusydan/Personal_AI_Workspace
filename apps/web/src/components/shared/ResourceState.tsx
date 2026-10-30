'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { notifyUnauthorized } from './SessionContext';

export const secondaryButton =
  'inline-flex min-h-touch items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusRing disabled:cursor-not-allowed disabled:opacity-60';
export const primaryButton =
  'inline-flex min-h-touch items-center justify-center rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-action-foreground hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusRing disabled:cursor-not-allowed disabled:opacity-60';

export type Resource<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; data: T };

export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const request = ++sequence.current;
    let disposed = false;
    setState({ status: 'loading' });
    // List helpers do not expose AbortSignal. Bound the UI wait and ignore late responses.
    const timer = setTimeout(() => {
      if (!disposed && request === sequence.current) {
        sequence.current += 1;
        setState({ status: 'error' });
      }
    }, 15000);
    loadRef.current()
      .then(
        (data) => {
          if (!disposed && request === sequence.current) setState({ status: 'success', data });
        },
        (error: unknown) => {
          if (!disposed && request === sequence.current) {
            notifyUnauthorized(error);
            setState({ status: 'error' });
          }
        },
      )
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  return { state, retry };
}

export function readList<T>(response: { data?: T[] }): T[] {
  if (!Array.isArray(response.data)) throw new Error('Expected a list response');
  return response.data;
}

export function ResourceNotice({
  status,
  noun,
  onRetry,
}: {
  status: 'loading' | 'error';
  noun: string;
  onRetry: () => void;
}) {
  if (status === 'loading')
    return (
      <p role="status" className="py-6 text-sm text-text-secondary">
        Loading {noun}…
      </p>
    );
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-border bg-surface-subtle p-4">
      <p className="text-sm text-text-primary">
        Could not load {noun}. Data is unavailable, not empty.
      </p>
      <button type="button" onClick={onRetry} className={secondaryButton}>
        Try again
      </button>
    </div>
  );
}
