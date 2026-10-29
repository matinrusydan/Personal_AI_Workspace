'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ThemeMode,
  ThemePreset,
  ThemeDensity,
  ThemeRadius,
  resolveTokens,
  isWcagCompliant,
  radiusTokens,
  deriveValidatedCustomTheme,
} from '@paw/ui';

interface ThemeContextType {
  mode: ThemeMode;
  preset: ThemePreset;
  density: ThemeDensity;
  radius: ThemeRadius;
  customAccent: string;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  setDensity: (density: ThemeDensity) => void;
  setRadius: (radius: ThemeRadius) => void;
  setCustomAccent: (accent: string) => void;
  isCompliant: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [preset, setPresetState] = useState<ThemePreset>('default');
  const [density, setDensityState] = useState<ThemeDensity>('normal');
  const [radius, setRadiusState] = useState<ThemeRadius>('md');
  const [customAccent, setCustomAccentState] = useState<string>('#2563EB');
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  // Load stored preferences on mount
  useEffect(() => {
    try {
      const storedMode = localStorage.getItem('paw_theme_mode') as ThemeMode | null;
      const storedPreset = localStorage.getItem('paw_theme_preset') as ThemePreset | null;
      const storedDensity = localStorage.getItem('paw_theme_density') as ThemeDensity | null;
      const storedRadius = localStorage.getItem('paw_theme_radius') as ThemeRadius | null;
      const storedAccent = localStorage.getItem('paw_theme_accent');

      if (storedMode && ['light', 'dark', 'system'].includes(storedMode)) {
        setModeState(storedMode);
      }
      if (storedPreset && ['default', 'forest', 'ocean', 'custom'].includes(storedPreset)) {
        setPresetState(storedPreset);
      }
      if (storedDensity && ['compact', 'normal', 'spacious'].includes(storedDensity)) {
        setDensityState(storedDensity);
      }
      if (storedRadius && ['none', 'sm', 'md', 'lg', 'xl'].includes(storedRadius)) {
        setRadiusState(storedRadius);
      }
      if (storedAccent) {
        setCustomAccentState(storedAccent);
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  // Update DOM when theme state changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const computeResolved = () => {
      if (mode === 'system') {
        return mediaQuery.matches ? 'dark' : 'light';
      }
      return mode;
    };

    const currentResolved = computeResolved();
    setResolvedMode(currentResolved);

    // Apply attributes and CSS variables to document root
    const root = document.documentElement;
    root.setAttribute('data-theme', currentResolved);
    root.setAttribute('data-preset', preset);
    root.setAttribute('data-density', density);

    if (currentResolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply radius token dynamically
    const radiusValue = radiusTokens[radius] || radiusTokens.md;
    root.style.setProperty('--paw-radius-md', radiusValue);

    // If custom preset, derive and set custom accent
    if (preset === 'custom') {
      const { tokens } = deriveValidatedCustomTheme(customAccent, currentResolved);
      root.style.setProperty('--paw-color-action-primary', tokens.actionPrimary);
      root.style.setProperty('--paw-color-focus-ring', tokens.focusRing);
    } else {
      root.style.removeProperty('--paw-color-action-primary');
      root.style.removeProperty('--paw-color-focus-ring');
    }

    const listener = () => {
      if (mode === 'system') {
        const newResolved = mediaQuery.matches ? 'dark' : 'light';
        setResolvedMode(newResolved);
        root.setAttribute('data-theme', newResolved);
        if (newResolved === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [mode, preset, density, radius, customAccent]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('paw_theme_mode', newMode);
    } catch {
      // Ignore
    }
  };

  const setPreset = (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    try {
      localStorage.setItem('paw_theme_preset', newPreset);
    } catch {
      // Ignore
    }
  };

  const setDensity = (newDensity: ThemeDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem('paw_theme_density', newDensity);
    } catch {
      // Ignore
    }
  };

  const setRadius = (newRadius: ThemeRadius) => {
    setRadiusState(newRadius);
    try {
      localStorage.setItem('paw_theme_radius', newRadius);
    } catch {
      // Ignore
    }
  };

  const setCustomAccent = (newAccent: string) => {
    setCustomAccentState(newAccent);
    try {
      localStorage.setItem('paw_theme_accent', newAccent);
    } catch {
      // Ignore
    }
  };

  // Evaluate WCAG compliance of active palette
  const activeTokens = resolveTokens(resolvedMode, preset);
  const isCompliant = isWcagCompliant(activeTokens.textPrimary, activeTokens.canvas);

  return (
    <ThemeContext.Provider
      value={{
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
