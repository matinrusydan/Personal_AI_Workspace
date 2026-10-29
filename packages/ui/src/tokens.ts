/**
 * Semantic Design Tokens according to W3C Design Tokens format
 * Defined in docs/DESIGN_SYSTEM.md
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

export const spacingTokens = {
  0: '0px',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
} as const;

export const radiusTokens = {
  none: '0px',
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  full: '9999px',
} as const;

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
