'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import { ThemeMode, ThemePreset, ThemeDensity, ThemeRadius, calculateContrastRatio } from '@paw/ui';

export function ThemeSwitcher() {
  const {
    mode,
    preset,
    density,
    radius,
    customAccent,
    resolvedMode,
    setMode,
    setPreset,
    setDensity,
    setRadius,
    setCustomAccent,
    isCompliant,
  } = useTheme();

  const modes: { label: string; value: ThemeMode }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'system' },
  ];

  const presets: { label: string; value: ThemePreset; desc: string }[] = [
    { label: 'Default', value: 'default', desc: 'Slate & Royal Blue' },
    { label: 'Forest', value: 'forest', desc: 'Sage & Emerald' },
    { label: 'Ocean', value: 'ocean', desc: 'Cyan & Deep Sky' },
    { label: 'Custom', value: 'custom', desc: 'Personal Accent & Tuning' },
  ];

  const densities: { label: string; value: ThemeDensity }[] = [
    { label: 'Compact', value: 'compact' },
    { label: 'Normal', value: 'normal' },
    { label: 'Spacious', value: 'spacious' },
  ];

  const radii: { label: string; value: ThemeRadius }[] = [
    { label: 'None (0px)', value: 'none' },
    { label: 'Small (4px)', value: 'sm' },
    { label: 'Medium (6px)', value: 'md' },
    { label: 'Large (8px)', value: 'lg' },
    { label: 'XL (12px)', value: 'xl' },
  ];

  const quickAccents = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706', '#0284C7'];

  // Contrast check for custom accent against white text
  const customContrast = calculateContrastRatio('#FFFFFF', customAccent);
  const customContrastCompliant = customContrast >= 3.0;

  const handleReset = () => {
    setMode('system');
    setPreset('default');
    setDensity('normal');
    setRadius('md');
    setCustomAccent('#2563EB');
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Theme & Personalization (ADR-012)
          </h3>
          <p className="text-sm text-text-secondary">
            Customize system mode, semantic color palettes, layout density, and corner geometry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isCompliant
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-warning/10 text-warning border border-warning/20'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {isCompliant ? 'WCAG 2.2 AA (>=4.5:1)' : 'Contrast Warning'}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Mode selection */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">
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
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">
          Color Presets
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
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

      {/* Custom Theme Builder (visible when custom preset active) */}
      {preset === 'custom' && (
        <div className="rounded-lg border border-border-subtle bg-surface-subtle/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-text-primary">Custom Theme Accent Builder</h4>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                customContrastCompliant
                  ? 'text-success bg-success/10'
                  : 'text-warning bg-warning/10'
              }`}
            >
              Contrast Ratio: {customContrast.toFixed(2)}:1
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="color"
              value={customAccent}
              onChange={(e) => setCustomAccent(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent p-1"
            />
            <div className="flex flex-wrap gap-2">
              {quickAccents.map((accent) => (
                <button
                  key={accent}
                  type="button"
                  onClick={() => setCustomAccent(accent)}
                  style={{ backgroundColor: accent }}
                  className="h-8 w-8 rounded-full border border-white/20 shadow-sm transition-transform hover:scale-110"
                  title={accent}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Layout Density & Corner Radius */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-border-subtle">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Layout Density
          </label>
          <div className="grid grid-cols-3 gap-2">
            {densities.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDensity(d.value)}
                className={`flex h-10 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                  density === d.value
                    ? 'border-action-primary bg-action-primary/10 text-action-primary font-bold'
                    : 'border-border bg-surface hover:bg-surface-subtle text-text-secondary'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Corner Geometry (Radius)
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {radii.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRadius(r.value)}
                className={`flex h-10 items-center justify-center rounded-md border text-[11px] font-medium transition-colors ${
                  radius === r.value
                    ? 'border-action-primary bg-action-primary/10 text-action-primary font-bold'
                    : 'border-border bg-surface hover:bg-surface-subtle text-text-secondary'
                }`}
              >
                {r.value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
