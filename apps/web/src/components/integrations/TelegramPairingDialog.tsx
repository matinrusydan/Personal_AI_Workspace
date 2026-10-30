'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { integrationsApi } from '@/lib/api';
import { primaryButton, secondaryButton } from '../shared/ResourceState';
import { useToast } from '../shared/ToastProvider';

interface TelegramPairingDialogProps {
  onClose: () => void;
  onPaired: () => void;
}

export function TelegramPairingDialog({ onClose, onPaired }: TelegramPairingDialogProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    manualCode: string;
    deepLink: string;
    botUsername: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const challengeIdRef = useRef<string | null>(null);

  const startPairing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await integrationsApi.createTelegramPairing();
      setChallenge(res.data);
      challengeIdRef.current = res.data.challengeId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulai pairing Telegram';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startPairing();
  }, [startPairing]);

  // Poll pairing status every 3 seconds while dialog is open
  useEffect(() => {
    if (!challenge?.challengeId) return;

    const interval = setInterval(async () => {
      try {
        const res = await integrationsApi.getTelegramPairingStatus(challenge.challengeId);
        if (res.data?.status === 'paired') {
          clearInterval(interval);
          toast({ tone: 'success', message: 'Telegram bot berhasil terhubung!' });
          onPaired();
          onClose();
        } else if (res.data?.status === 'expired' || res.data?.status === 'canceled') {
          clearInterval(interval);
          setError('Sesi pairing telah berakhir atau dibatalkan.');
        }
      } catch {
        // Ignore background polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [challenge, onPaired, onClose, toast]);

  const handleCancel = async () => {
    if (challengeIdRef.current) {
      try {
        await integrationsApi.cancelTelegramPairing(challengeIdRef.current);
      } catch {
        // Ignore cleanup failure
      }
    }
    onClose();
  };

  const copyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ tone: 'info', message: 'Perintah disalin ke clipboard.' });
    } catch {
      toast({ tone: 'error', message: 'Gagal menyalin teks.' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="telegram-pairing-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 id="telegram-pairing-title" className="text-lg font-bold text-text-primary">
            Hubungkan Bot Telegram
          </h3>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Tutup dialog"
            className="rounded p-1 text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            <p>Memverifikasi bot dan membuat kode pairing...</p>
          </div>
        ) : error ? (
          <div className="space-y-4 py-4">
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleCancel} className={secondaryButton}>
                Tutup
              </button>
              <button type="button" onClick={startPairing} className={primaryButton}>
                Coba Lagi
              </button>
            </div>
          </div>
        ) : challenge ? (
          <div className="space-y-4 py-4 text-sm text-text-secondary">
            <p>
              Untuk mengamankan integrasi, bot hanya menerima perintah dari akun Telegram pemilik
              yang dipasangkan secara eksplisit.
            </p>

            <div className="rounded-lg border border-border bg-surface-subtle p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Metode 1: Tautan Langsung
              </div>
              <a
                href={challenge.deepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-action-foreground shadow-sm hover:bg-action-primary-hover transition-colors"
              >
                Buka Bot di Telegram ({challenge.botUsername}) &rarr;
              </a>
            </div>

            <div className="rounded-lg border border-border bg-surface-subtle p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Metode 2: Kirim Perintah Manual
              </div>
              <p className="text-xs text-text-secondary">
                Buka bot <span className="font-semibold text-text-primary">@{challenge.botUsername}</span> di Telegram, lalu kirim pesan:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text-primary break-all">
                  /start {challenge.manualCode}
                </code>
                <button
                  type="button"
                  onClick={() => copyCode(`/start ${challenge.manualCode}`)}
                  className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
                >
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted pt-2">
              <span>Menunggu konfirmasi obrolan dari bot…</span>
              <span>Berlaku 10 menit</span>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={handleCancel} className={secondaryButton}>
                Batal
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
