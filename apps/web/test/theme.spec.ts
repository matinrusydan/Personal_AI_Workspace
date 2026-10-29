import { describe, it, expect } from 'vitest';
import { resolveTokens, themePresets, calculateContrastRatio, isWcagCompliant } from '@paw/ui';

describe('Theme Engine & Contrast Validator (Milestone P1-04)', () => {
  it('resolves default preset for light and dark modes', () => {
    const light = resolveTokens('light', 'default');
    const dark = resolveTokens('dark', 'default');

    expect(light.canvas).toBe('#F8FAFC');
    expect(dark.canvas).toBe('#0B1220');
  });

  it('resolves forest and ocean presets accurately', () => {
    const forest = resolveTokens('light', 'forest');
    const ocean = resolveTokens('dark', 'ocean');

    expect(forest.canvas).toBe('#F6FAF7');
    expect(ocean.canvas).toBe('#081724');
  });

  it('guarantees WCAG 2.2 AA compliance (ratio >= 4.5) for all preset text pairings', () => {
    const presets = Object.keys(themePresets) as (keyof typeof themePresets)[];

    for (const preset of presets) {
      const light = themePresets[preset].light;
      const dark = themePresets[preset].dark;

      const lightRatio = calculateContrastRatio(light.textPrimary, light.canvas);
      const darkRatio = calculateContrastRatio(dark.textPrimary, dark.canvas);

      expect(lightRatio).toBeGreaterThanOrEqual(4.5);
      expect(darkRatio).toBeGreaterThanOrEqual(4.5);
      expect(isWcagCompliant(light.textPrimary, light.canvas)).toBe(true);
      expect(isWcagCompliant(dark.textPrimary, dark.canvas)).toBe(true);
    }
  });

  it('identifies and fails insufficient contrast color combinations', () => {
    // Low contrast combination: very light gray on white
    const lowContrast = calculateContrastRatio('#E2E8F0', '#FFFFFF');
    expect(lowContrast).toBeLessThan(4.5);
    expect(isWcagCompliant('#E2E8F0', '#FFFFFF')).toBe(false);
  });
});
