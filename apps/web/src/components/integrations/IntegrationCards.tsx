'use client';

import React, { useState } from 'react';
import {
  integrationsApi,
  type IntegrationStatusItem,
  type IntegrationProvider,
} from '@/lib/api';
import { primaryButton, secondaryButton, useResource } from '../shared/ResourceState';
import { useToast } from '../shared/ToastProvider';
import { TelegramPairingDialog } from './TelegramPairingDialog';

const providerMeta: Record<
  IntegrationProvider,
  { name: string; description: string; icon: string }
> = {
  google: {
    name: 'Google Calendar & Meet',
    description: 'Sinkronisasi agenda kalender dan pembuatan tautan Google Meet.',
    icon: 'G',
  },
  zoom: {
    name: 'Zoom Meeting',
    description: 'Penyediaan tautan dan ID ruang konferensi video Zoom.',
    icon: 'Z',
  },
  telegram: {
    name: 'Telegram Bot Gateway',
    description: 'Pemberitahuan reminder instan dan perintah cepat via bot Telegram.',
    icon: 'T',
  },
};

const loadIntegrations = async () => {
  const res = await integrationsApi.list();
  return res.data;
};

export function IntegrationCards() {
  const toast = useToast();
  const integrations = useResource(loadIntegrations);

  const [activePairingModal, setActivePairingModal] = useState(false);
  const [inFlightAction, setInFlightAction] = useState<string | null>(null);

  const handleConnectOAuth = async (provider: 'google' | 'zoom') => {
    setInFlightAction(`connect_${provider}`);
    try {
      const res = await integrationsApi.startConnect(provider);
      if (res.data?.authorizationUrl) {
        window.location.assign(res.data.authorizationUrl);
      } else {
        throw new Error('URL otorisasi tidak ditemukan');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulai koneksi OAuth';
      toast({ tone: 'error', message: msg });
      setInFlightAction(null);
    }
  };

  const handleTestConnection = async (provider: IntegrationProvider) => {
    if (provider === 'telegram') {
      const ok = confirm('Kirimkan pesan uji coba nyata ke chat Telegram Anda yang terpasang?');
      if (!ok) return;
    }

    setInFlightAction(`test_${provider}`);
    try {
      const res = await integrationsApi.test(provider);
      toast({
        tone: 'success',
        message: `Uji koneksi ${providerMeta[provider].name} berhasil: ${res.data?.message || 'Terverifikasi aktif'}`,
      });
      integrations.retry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Uji koneksi gagal';
      toast({ tone: 'error', message: `Gagal verifikasi: ${msg}` });
      integrations.retry();
    } finally {
      setInFlightAction(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    const ok = confirm(`Yakin ingin memutuskan koneksi ${providerMeta[provider].name}?`);
    if (!ok) return;

    setInFlightAction(`disconnect_${provider}`);
    try {
      await integrationsApi.disconnect(provider);
      toast({ tone: 'info', message: `Koneksi ${providerMeta[provider].name} telah dicabut.` });
      integrations.retry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memutuskan integrasi';
      toast({ tone: 'error', message: msg });
    } finally {
      setInFlightAction(null);
    }
  };

  const items = integrations.state.status === 'success' ? integrations.state.data : [];

  return (
    <section
      aria-labelledby="providers-title"
      className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="providers-title" className="text-base font-semibold">
            Integrasi Layanan Eksternal
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Koneksi OAuth dan Bot diotorisasi secara aman melalui server tanpa membocorkan kredensial.
          </p>
        </div>
        <button
          type="button"
          onClick={integrations.retry}
          disabled={integrations.state.status === 'loading'}
          className={secondaryButton}
        >
          Muat Ulang Status
        </button>
      </div>

      {integrations.state.status === 'loading' ? (
        <div className="py-8 text-center text-sm text-text-secondary">
          Memeriksa status integrasi...
        </div>
      ) : integrations.state.status === 'error' ? (
        <div role="alert" className="rounded-lg border border-border bg-surface-subtle p-4 space-y-3">
          <p className="text-sm text-destructive">
            Gagal memuat status integrasi dari server. Status koneksi tidak dapat dipastikan.
          </p>
          <button type="button" onClick={integrations.retry} className={secondaryButton}>
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {(['google', 'zoom', 'telegram'] as const).map((pKey) => {
            const item = items.find((i) => i.provider === pKey) || {
              provider: pKey,
              status: 'NOT_CONFIGURED' as const,
            };
            const meta = providerMeta[pKey];
            const isBusy = inFlightAction?.includes(pKey);

            return (
              <div
                key={pKey}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-action-primary/30 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{meta.name}</h3>
                    <StatusBadge status={item.status} />
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    {meta.description}
                  </p>

                  {item.status === 'CONNECTED' && item.account && (
                    <div className="mt-3 rounded border border-border bg-surface-subtle p-2 text-[11px] text-text-secondary space-y-0.5">
                      <div className="font-medium text-text-primary truncate">
                        {item.account.displayName || item.account.email || item.account.username || 'Akun Terhubung'}
                      </div>
                      {item.account.email && item.account.displayName && (
                        <div className="truncate text-text-muted">{item.account.email}</div>
                      )}
                      {item.lastVerifiedAt && (
                        <div className="text-[10px] text-text-muted pt-1">
                          Terverifikasi: {new Date(item.lastVerifiedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </div>
                  )}

                  {item.status === 'NOT_CONFIGURED' && (
                    <p className="mt-2 text-[11px] text-text-muted">
                      {item.configGuidance || 'Kredensial belum dikonfigurasi di file .env server.'}
                    </p>
                  )}

                  {item.error && item.status !== 'NOT_CONFIGURED' && (
                    <p className="mt-2 text-[11px] text-destructive">
                      Perhatian: {item.error.message}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  {item.status === 'NOT_CONFIGURED' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-text-muted opacity-60 cursor-not-allowed"
                    >
                      Konfigurasi .env Diperlukan
                    </button>
                  ) : item.status === 'CONNECTED' ? (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTestConnection(pKey)}
                        className="flex-1 rounded-md bg-action-primary/10 border border-action-primary/30 px-3 py-1.5 text-xs font-semibold text-action-primary hover:bg-action-primary/20 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? 'Menguji…' : 'Uji Koneksi'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDisconnect(pKey)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        Putuskan
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (pKey === 'telegram') {
                          setActivePairingModal(true);
                        } else {
                          handleConnectOAuth(pKey);
                        }
                      }}
                      className={`w-full ${primaryButton} text-xs py-1.5 disabled:opacity-50`}
                    >
                      {isBusy
                        ? 'Memproses…'
                        : pKey === 'telegram'
                          ? 'Pasangkan Bot Telegram'
                          : `Hubungkan ${meta.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activePairingModal && (
        <TelegramPairingDialog
          onClose={() => setActivePairingModal(false)}
          onPaired={() => integrations.retry()}
        />
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: IntegrationStatusItem['status'] }) {
  switch (status) {
    case 'CONNECTED':
      return (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Terverifikasi
        </span>
      );
    case 'DISCONNECTED':
      return (
        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
          Belum Terhubung
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          Sesi Berakhir
        </span>
      );
    case 'ERROR':
      return (
        <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          Error
        </span>
      );
    case 'NOT_CONFIGURED':
    default:
      return (
        <span className="rounded border border-border bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-text-muted">
          Belum Dikonfigurasi
        </span>
      );
  }
}
