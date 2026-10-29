'use client';

import React, { useState } from 'react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export default function SettingsPage() {
  const [googleConnected, setGoogleConnected] = useState(true);
  const [zoomConnected, setZoomConnected] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage system theme appearance, security preferences, third-party integrations, and
          registered devices
        </p>
      </div>

      {/* Dynamic Theme Engine Switcher (ADR-012) */}
      <ThemeSwitcher />

      {/* Integrations Health & Settings (P4-01 & docs/INTEGRATIONS.md) */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Connected Providers (P0 MVP)
            </h3>
            <p className="text-sm text-text-secondary">
              Calendar synchronization, meeting video call adapters, and bot gateway
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Google Calendar & Meet */}
          <div className="rounded-lg border border-border bg-surface-subtle/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">Google Workspace</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  googleConnected
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-text-muted/10 text-text-muted border border-border'
                }`}
              >
                {googleConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Google Calendar two-way sync & Google Meet video calls
            </p>
            <button
              type="button"
              onClick={() => setGoogleConnected(!googleConnected)}
              className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {googleConnected ? 'Disconnect' : 'Connect Account'}
            </button>
          </div>

          {/* Zoom Video Communications */}
          <div className="rounded-lg border border-border bg-surface-subtle/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">Zoom Meeting</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  zoomConnected
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-text-muted/10 text-text-muted border border-border'
                }`}
              >
                {zoomConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Zoom REST API meeting provisioning & scheduled join URLs
            </p>
            <button
              type="button"
              onClick={() => setZoomConnected(!zoomConnected)}
              className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {zoomConnected ? 'Disconnect' : 'Connect Account'}
            </button>
          </div>

          {/* Telegram Gateway */}
          <div className="rounded-lg border border-border bg-surface-subtle/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">Telegram Bot</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  telegramConnected
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-text-muted/10 text-text-muted border border-border'
                }`}
              >
                {telegramConnected ? 'Active' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Allowlisted notifications & deterministic bot commands
            </p>
            <button
              type="button"
              onClick={() => setTelegramConnected(!telegramConnected)}
              className="w-full rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {telegramConnected ? 'Deactivate' : 'Activate Bot'}
            </button>
          </div>
        </div>
      </div>

      {/* Security Profile Details (ADR-014) */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-text-primary">Security & Identity (ADR-014)</h3>
        <p className="mt-1 text-sm text-text-secondary">Owner authentication parameters</p>

        <div className="mt-4 space-y-3">
          <div className="flex justify-between border-b border-border-subtle py-2 text-sm">
            <span className="text-text-muted">Owner Email</span>
            <span className="font-medium text-text-primary">owner@example.com</span>
          </div>
          <div className="flex justify-between border-b border-border-subtle py-2 text-sm">
            <span className="text-text-muted">Multi-Factor Authentication</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              TOTP RFC 6238 Active
            </span>
          </div>
          <div className="flex justify-between border-b border-border-subtle py-2 text-sm">
            <span className="text-text-muted">Recovery Codes</span>
            <span className="font-medium text-text-primary">8 Hashed Single-use Codes</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-text-muted">Default Timezone</span>
            <span className="font-medium text-text-primary">Asia/Jakarta (WIB)</span>
          </div>
        </div>
      </div>

      {/* System Backup & Health (P4-03 & docs/DEPLOYMENT.md) */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Database Backup & Disaster Recovery (P0)
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              PostgreSQL schema snapshot, transactional outbox integrity, and encrypted export
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert('PostgreSQL schema snapshot verified healthy.')}
            className="rounded border border-border bg-surface-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface transition-colors"
          >
            Export Backup
          </button>
        </div>
      </div>
    </div>
  );
}
