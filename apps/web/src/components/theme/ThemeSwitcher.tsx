'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { ThemeMode, ThemePreset } from '@paw/ui';

export function ThemeSwitcher() {
  const { mode, preset, resolvedMode, setMode, setPreset, isCompliant } = useTheme();

  const modes: { label: string; value: ThemeMode }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  const presets: { label: string; value: ThemePreset; desc: string }[] = [
    { label: 'Default', value: 'default', desc: 'Slate & Royal Blue' },
    { label: 'Forest', value: 'forest', desc: 'Sage & Emerald' },
    { label: 'Ocean', value: 'ocean', desc: 'Cyan & Deep Sky' },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Theme Appearance</h3>
          <p className="text-sm text-text-secondary">
            Customize interface mode and semantic color presets
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isCompliant
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-warning/10 text-warning border border-warning/20'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {isCompliant ? 'WCAG 2.2 AA Verified' : 'Checking Contrast'}
        </span>
      </div>

      {/* Mode selection */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Display Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`flex h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                mode === m.value
                  ? 'border-action-primary bg-action-primary/10 text-action-primary font-semibold ring-1 ring-action-primary'
                  : 'border-border bg-surface hover:bg-surface-subtle text-text-secondary'
              }`}
            >
              {m.label}
              {m.value === 'system' && (
                <span className="ml-1 text-xs text-text-muted">({resolvedMode})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preset selection */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-muted">
          Color Preset
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={`flex flex-col items-start rounded-md border p-3 text-left transition-colors ${
                preset === p.value
                  ? 'border-action-primary bg-action-primary/10 ring-1 ring-action-primary'
                  : 'border-border bg-surface hover:bg-surface-subtle'
              }`}
            >
              <span className="text-sm font-semibold text-text-primary">{p.label}</span>
              <span className="text-xs text-text-muted">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
