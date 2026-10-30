'use client';

import React, { useState } from 'react';
import { authApi, type AuthSettings } from '@/lib/api';
import { primaryButton, secondaryButton, useResource } from './ResourceState';
import { notifyUnauthorized, readAccount } from './SessionContext';
import { useToast } from './ToastProvider';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const loadSettings = async (): Promise<AuthSettings> => {
  const { data } = await authApi.settings();
  // Missing or malformed security data must never become an "inactive" or zero status.
  if (
    !data ||
    typeof data.mfa?.enabled !== 'boolean' ||
    !isCount(data.mfa.authenticatorsCount) ||
    !isCount(data.mfa.recoveryCodesRemaining) ||
    !isCount(data.activeSessionsCount) ||
    !Array.isArray(data.sessions) ||
    data.activeSessionsCount !== data.sessions.length ||
    data.sessions.some(
      (session) =>
        !session ||
        typeof session.id !== 'string' ||
        !session.id ||
        typeof session.current !== 'boolean' ||
        (session.deviceId !== null && typeof session.deviceId !== 'string') ||
        typeof session.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(session.createdAt)) ||
        typeof session.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(session.expiresAt)),
    )
  ) {
    throw new Error('Incomplete security settings');
  }
  readAccount({ data: data.profile });
  return data;
};

export function AccountSecurity({ onProfileUpdated }: { onProfileUpdated: () => void }) {
  const settings = useResource(loadSettings);
  const toast = useToast();
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const busy = saving || revoking !== null;
  const data = settings.state.status === 'success' ? settings.state.data : null;
  const timezone = timezoneDraft ?? data?.profile.timezone ?? '';

  async function saveTimezone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !data) return;
    const requestedTimezone = timezone.trim();
    try {
      if (!requestedTimezone) throw new Error('Missing timezone');
      new Intl.DateTimeFormat('id-ID', { timeZone: requestedTimezone }).format();
    } catch {
      setMutationError('Masukkan zona waktu IANA yang valid, misalnya Asia/Jakarta.');
      return;
    }
    setSaving(true);
    setMutationError(null);
    let accepted = false;
    try {
      await authApi.updateProfile({ timezone: requestedTimezone });
      accepted = true;
      // Confirm the persisted preference through an independent account read.
      const confirmed = readAccount(await authApi.getMe());
      if (confirmed.timezone !== requestedTimezone) throw new Error('Timezone not confirmed');
      setTimezoneDraft(null);
      toast({ tone: 'success', message: 'Zona waktu tersimpan dan telah dikonfirmasi oleh server.' });
    } catch (error) {
      notifyUnauthorized(error);
      const message = accepted
        ? 'Penyimpanan diterima, tetapi zona waktu terbaru belum dapat dikonfirmasi. Muat ulang sebelum mencoba lagi.'
        : 'Zona waktu belum dapat dipastikan tersimpan. Periksa data terbaru sebelum mencoba lagi.';
      setMutationError(message);
      toast({ tone: 'error', message });
    } finally {
      // A failed response can follow a committed write; never keep showing stale certainty.
      settings.retry();
      onProfileUpdated();
      setSaving(false);
    }
  }

  async function revokeSession(session: AuthSettings['sessions'][number]) {
    if (busy || !data) return;
    const question = session.current
      ? 'Akhiri sesi ini? Anda harus masuk kembali untuk menggunakan workspace.'
      : 'Cabut sesi ini? Perangkat tersebut harus masuk kembali.';
    if (!window.confirm(question)) return;
    setRevoking(session.id);
    setMutationError(null);
    try {
      const result = await authApi.revokeSession(session.id);
      if (result.success !== true) throw new Error('Session revocation not confirmed');
      toast({ tone: 'success', message: 'Pencabutan sesi telah dikonfirmasi oleh server.' });
      if (session.current) notifyUnauthorized({ status: 401 });
    } catch (error) {
      notifyUnauthorized(error);
      const message = 'Pencabutan sesi belum dapat dikonfirmasi. Muat ulang untuk memeriksa status terbaru.';
      setMutationError(message);
      toast({ tone: 'error', message });
    } finally {
      settings.retry();
      setRevoking(null);
    }
  }

  return (
    <section
      aria-labelledby="account-security-title"
      className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="account-security-title" className="text-base font-semibold">
            Keamanan akun dan preferensi
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Status MFA dan sesi hanya ditampilkan setelah terverifikasi dari server.
          </p>
        </div>
        <button
          type="button"
          onClick={settings.retry}
          disabled={busy || settings.state.status === 'loading'}
          className={secondaryButton}
        >
          Muat ulang keamanan
        </button>
      </div>

      {mutationError ? (
        <p role="alert" className="rounded-lg border border-border bg-surface-subtle p-4 text-sm">
          {mutationError}
        </p>
      ) : null}

      {settings.state.status === 'loading' ? (
        <p role="status" className="py-4 text-sm text-text-secondary">
          Memuat keamanan akun dan sesi…
        </p>
      ) : settings.state.status === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-border bg-surface-subtle p-4">
          <p className="text-sm">
            Data keamanan tidak tersedia. Status MFA, jumlah kode pemulihan, dan sesi belum dapat
            diverifikasi; ini bukan berarti MFA nonaktif atau tidak ada sesi.
          </p>
          <button type="button" onClick={settings.retry} className={secondaryButton}>
            Coba lagi
          </button>
        </div>
      ) : data ? (
        <>
          <dl className="divide-y divide-border text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-text-secondary">Autentikasi multifaktor (MFA)</dt>
              <dd className="font-medium">{data.mfa.enabled ? 'Aktif' : 'Nonaktif'}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-text-secondary">Autentikator terverifikasi</dt>
              <dd>{data.mfa.authenticatorsCount}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt className="text-text-secondary">Kode pemulihan tersisa</dt>
              <dd>{data.mfa.recoveryCodesRemaining}</dd>
            </div>
          </dl>
          <p className="text-xs text-text-secondary">
            Kode pemulihan tidak ditampilkan di sini. Simpan kode yang diperoleh saat pendaftaran MFA
            di tempat aman.
          </p>

          <form onSubmit={saveTimezone} className="space-y-3 border-t border-border pt-5">
            <label htmlFor="account-timezone" className="block text-sm font-medium">
              Zona waktu akun
            </label>
            <p id="account-timezone-help" className="text-xs text-text-secondary">
              Gunakan nama zona waktu IANA. Preferensi ini tidak mengubah waktu kejadian yang telah
              tersimpan.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                id="account-timezone"
                name="timezone"
                type="text"
                required
                maxLength={100}
                autoCapitalize="none"
                spellCheck={false}
                value={timezone}
                onChange={(event) => setTimezoneDraft(event.target.value)}
                disabled={busy}
                aria-describedby="account-timezone-help"
                className="min-h-touch min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || timezone.trim() === data.profile.timezone}
                className={primaryButton}
              >
                {saving ? 'Menyimpan dan memverifikasi…' : 'Simpan zona waktu'}
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              Zona waktu terverifikasi: {data.profile.timezone}
            </p>
          </form>

          <div className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Sesi aktif ({data.activeSessionsCount})</h3>
            <p className="text-xs text-text-secondary">
              Waktu ditampilkan dalam {data.profile.timezone}. Mencabut sesi mewajibkan masuk kembali,
              bukan menghapus pendaftaran perangkat.
            </p>
            {data.sessions.length === 0 ? (
              <p className="py-3 text-sm text-text-secondary">
                Server melaporkan tidak ada sesi aktif.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.sessions.map((session, index) => (
                  <li key={session.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                    <div className="min-w-0 space-y-2 text-sm">
                      <p className="font-medium">
                        Sesi {index + 1}{session.current ? ' — sesi ini' : ''}
                      </p>
                      <p className="break-all text-xs text-text-secondary">
                        {session.deviceId ? `Perangkat: ${session.deviceId}` : 'Perangkat tidak tercatat'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Dibuat:{' '}
                        <time dateTime={session.createdAt}>
                          {new Intl.DateTimeFormat('id-ID', {
                            timeZone: data.profile.timezone,
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(session.createdAt))}
                        </time>
                      </p>
                      <p className="text-xs text-text-secondary">
                        Kedaluwarsa:{' '}
                        <time dateTime={session.expiresAt}>
                          {new Intl.DateTimeFormat('id-ID', {
                            timeZone: data.profile.timezone,
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(session.expiresAt))}
                        </time>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revokeSession(session)}
                      disabled={busy}
                      aria-label={`Cabut sesi ${index + 1}${session.current ? ', sesi ini' : ''}`}
                      className={secondaryButton}
                    >
                      {revoking === session.id ? 'Mencabut sesi…' : session.current ? 'Akhiri sesi ini' : 'Cabut sesi'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
