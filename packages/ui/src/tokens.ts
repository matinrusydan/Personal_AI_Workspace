/**
 * Semantic Design Tokens according to W3C Design Tokens format
 * Defined in docs/DESIGN_SYSTEM.md & ADR-012
 */

export interface ColorTokenGroup {
  canvas: string;
  surface: string;
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  actionPrimary: string;
  actionPrimaryHover: string;
  actionPrimaryForeground: string;
  destructive: string;
  warning: string;
  success: string;
  focusRing: string;
}

export type ThemePreset = 'default' | 'forest' | 'ocean' | 'custom';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeDensity = 'compact' | 'normal' | 'spacious';
export type ThemeRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export const lightTokens: ColorTokenGroup = {
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  actionPrimary: '#2563EB',
  actionPrimaryHover: '#1D4ED8',
  actionPrimaryForeground: '#FFFFFF',
  destructive: '#DC2626',
  warning: '#D97706',
  success: '#16A34A',
  focusRing: '#3B82F6',
};

export const darkTokens: ColorTokenGroup = {
  canvas: '#0B1220',
  surface: '#1E293B',
  surfaceSubtle: '#0F172A',
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  border: '#334155',
  borderSubtle: '#1E293B',
  actionPrimary: '#3B82F6',
  actionPrimaryHover: '#60A5FA',
  actionPrimaryForeground: '#FFFFFF',
  destructive: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  focusRing: '#60A5FA',
};

export const forestLightTokens: ColorTokenGroup = {
  ...lightTokens,
  canvas: '#F6FAF7',
  surface: '#FFFFFF',
  surfaceSubtle: '#EDF5EF',
  textPrimary: '#14281D',
  textSecondary: '#3C5A48',
  border: '#D2E3D8',
  actionPrimary: '#1B8A5A',
  actionPrimaryHover: '#146E47',
  focusRing: '#22C55E',
};

export const forestDarkTokens: ColorTokenGroup = {
  ...darkTokens,
  canvas: '#0B1A12',
  surface: '#152C20',
  surfaceSubtle: '#0F2117',
  textPrimary: '#ECF5F0',
  textSecondary: '#A3C4B2',
  border: '#244533',
  actionPrimary: '#22C55E',
  actionPrimaryHover: '#4ADE80',
  focusRing: '#4ADE80',
};

export const oceanLightTokens: ColorTokenGroup = {
  ...lightTokens,
  canvas: '#F4FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#E8F5F8',
  textPrimary: '#0C2738',
  textSecondary: '#34556B',
  border: '#CFE5EE',
  actionPrimary: '#0284C7',
  actionPrimaryHover: '#0369A1',
  focusRing: '#38BDF8',
};

export const oceanDarkTokens: ColorTokenGroup = {
  ...darkTokens,
  canvas: '#081724',
  surface: '#102A3E',
  surfaceSubtle: '#0B1E2D',
  textPrimary: '#E8F4FB',
  textSecondary: '#9BC2DB',
  border: '#1B3F5C',
  actionPrimary: '#0EA5E9',
  actionPrimaryHover: '#38BDF8',
  focusRing: '#38BDF8',
};

export const themePresets: Record<
  Exclude<ThemePreset, 'custom'>,
  { light: ColorTokenGroup; dark: ColorTokenGroup }
> = {
  default: { light: lightTokens, dark: darkTokens },
  forest: { light: forestLightTokens, dark: forestDarkTokens },
  ocean: { light: oceanLightTokens, dark: oceanDarkTokens },
};

export function resolveTokens(
  mode: 'light' | 'dark',
  preset: ThemePreset = 'default',
  customOverrides?: Partial<ColorTokenGroup>,
): ColorTokenGroup {
  let base: ColorTokenGroup;
  if (preset === 'custom' && customOverrides) {
    base =
      mode === 'dark'
        ? { ...darkTokens, ...customOverrides }
        : { ...lightTokens, ...customOverrides };
  } else {
    const selectedPreset =
      themePresets[preset as keyof typeof themePresets] || themePresets.default;
    base = mode === 'dark' ? selectedPreset.dark : selectedPreset.light;
  }
  return base;
}

export const densityPaddingMap: Record<
  ThemeDensity,
  { page: string; card: string; button: string }
> = {
  compact: { page: '0.75rem', card: '0.75rem', button: '0.375rem 0.75rem' },
  normal: { page: '1.25rem', card: '1rem', button: '0.5rem 1rem' },
  spacious: { page: '2rem', card: '1.5rem', button: '0.75rem 1.25rem' },
};

export const radiusTokens: Record<ThemeRadius, string> = {
  none: '0px',
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
};

/**
 * Validates WCAG contrast ratio (simple helper for theme engine)
 */
export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hex
      .replace('#', '')
      .match(/.{2}/g)
      ?.map((c) => parseInt(c, 16) / 255) ?? [0, 0, 0];
    const a = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return (a[0] ?? 0) * 0.2126 + (a[1] ?? 0) * 0.7152 + (a[2] ?? 0) * 0.0722;
  };

  const l1 = getLuminance(foregroundHex);
  const l2 = getLuminance(backgroundHex);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Checks if a color pairing satisfies WCAG 2.2 AA (>= 4.5 for normal text, >= 3.0 for large text/UI)
 */
export function isWcagCompliant(
  foregroundHex: string,
  backgroundHex: string,
  isLargeText = false,
): boolean {
  const ratio = calculateContrastRatio(foregroundHex, backgroundHex);
  return ratio >= (isLargeText ? 3.0 : 4.5);
}

/**
 * Creates custom theme with contrast correction
 */
export function deriveValidatedCustomTheme(
  accentHex: string,
  mode: 'light' | 'dark',
): { tokens: ColorTokenGroup; adjusted: boolean } {
  const base = mode === 'dark' ? { ...darkTokens } : { ...lightTokens };
  let adjusted = false;

  // Check if accent satisfies contrast against actionPrimaryForeground (white)
  const contrastWithWhite = calculateContrastRatio('#FFFFFF', accentHex);
  let effectiveAccent = accentHex;

  if (contrastWithWhite < 3.0) {
    // Darken accent for light mode or brighten for dark mode
    effectiveAccent = mode === 'dark' ? '#3B82F6' : '#1D4ED8';
    adjusted = true;
  }

  base.actionPrimary = effectiveAccent;
  base.focusRing = effectiveAccent;

  return { tokens: base, adjusted };
}
