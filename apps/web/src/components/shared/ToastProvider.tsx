'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}
interface ToastInput {
  message: string;
  tone?: ToastTone;
  duration?: number;
}
const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const show = useCallback(
    ({ message, tone = 'info', duration }: ToastInput) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, message, tone }]);
      // Important errors remain available until explicitly dismissed.
      const timeout = duration ?? (tone === 'error' ? 0 : 6000);
      if (timeout > 0)
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), timeout),
        );
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 top-20 z-50 mx-auto max-w-lg space-y-2"
      >
        {(['info', 'success', 'error'] as const).map((tone) => (
          <div
            key={tone}
            role={tone === 'error' ? 'alert' : 'status'}
            aria-live={tone === 'error' ? 'assertive' : 'polite'}
            aria-atomic="false"
            className="space-y-2"
          >
            {toasts
              .filter((toast) => toast.tone === tone)
              .map((toast) => (
                <div
                  key={toast.id}
                  className="pointer-events-auto flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-text-primary shadow-lg"
                >
                  <p>
                    <span className="font-semibold">
                      {tone === 'error' ? 'Error' : tone === 'success' ? 'Saved' : 'Notice'}:{' '}
                    </span>
                    {toast.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="min-h-touch shrink-0 rounded-md px-2 text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
                    aria-label="Dismiss notification"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast requires ToastProvider');
  return show;
}
