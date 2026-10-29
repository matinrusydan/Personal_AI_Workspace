import React from 'react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage system theme appearance, security preferences, and registered devices
        </p>
      </div>

      {/* Dynamic Theme Engine Switcher */}
      <ThemeSwitcher />

      {/* Security Profile Details */}
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
    </div>
  );
}
