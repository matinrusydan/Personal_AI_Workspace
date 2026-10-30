'use client';

import React, { useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { notifyUnauthorized, readAccount } from './SessionContext';
import { primaryButton } from './ResourceState';
import { useToast } from './ToastProvider';

const COOKIE = 'paw_browser_install_id';
export function browserInstallId(): string {
  const existing = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)
  )
    return existing;
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure browser identity is unavailable');
  const id = crypto.randomUUID();
  document.cookie = `${COOKIE}=${id}; Path=/; Max-Age=31536000; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
  if (!document.cookie.split(';').some((part) => part.trim() === `${COOKIE}=${id}`))
    throw new Error('Browser cookies are unavailable');
  return id;
}

export function BrowserEnrollment({ onRegistered }: { onRegistered: () => void }) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const toast = useToast();

  async function connect() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // Revalidate authentication at the explicit mutation boundary, not on page load.
      readAccount(await apiRequest('/me', { signal: controller.signal }));
      const installId = browserInstallId();
      const result = await apiRequest<{ data: { id: string } }>('/devices/register', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ platform: 'web', installId, deviceName: 'Web browser' }),
      });
      if (!result.data?.id) throw new Error('Registration was not confirmed');
      toast({
        tone: 'success',
        message: 'Browser registration saved. This does not enable native alarms.',
      });
      onRegistered();
    } catch (error) {
      notifyUnauthorized(error);
      toast({
        tone: 'error',
        message:
          'Browser registration was not confirmed. Check the device list before retrying. Cookies and a secure browser context are required.',
      });
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={connect} disabled={pending} className={primaryButton}>
        {pending ? 'Registering browser…' : 'Connect Browser'}
      </button>
      <p className="max-w-xl text-xs leading-relaxed text-text-secondary">
        Registers this browser only when you choose. A first-party installation cookie prevents
        duplicate registrations; no notification or native alarm permission is requested.
      </p>
    </div>
  );
}
