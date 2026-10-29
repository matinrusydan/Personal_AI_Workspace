'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode, ThemePreset, resolveTokens, isWcagCompliant } from '@paw/ui';

interface ThemeContextType {
  mode: ThemeMode;
  preset: ThemePreset;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  isCompliant: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [preset, setPresetState] = useState<ThemePreset>('default');
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  // Load stored preferences on mount
  useEffect(() => {
    try {
      const storedMode = localStorage.getItem('paw_theme_mode') as ThemeMode | null;
      const storedPreset = localStorage.getItem('paw_theme_preset') as ThemePreset | null;
      if (storedMode && ['light', 'dark', 'system'].includes(storedMode)) {
        setModeState(storedMode);
      }
      if (storedPreset && ['default', 'forest', 'ocean'].includes(storedPreset)) {
        setPresetState(storedPreset);
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  // Update DOM when mode, system preference, or preset changes
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

    // Apply attributes to document root
    const root = document.documentElement;
    root.setAttribute('data-theme', currentResolved);
    root.setAttribute('data-preset', preset);
    if (currentResolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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
  }, [mode, preset]);

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

  // Evaluate WCAG compliance of active palette
  const activeTokens = resolveTokens(resolvedMode, preset);
  const isCompliant = isWcagCompliant(activeTokens.textPrimary, activeTokens.canvas);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        preset,
        resolvedMode,
        setMode,
        setPreset,
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
