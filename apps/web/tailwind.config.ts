import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--paw-color-bg-canvas)',
        surface: {
          DEFAULT: 'var(--paw-color-surface)',
          subtle: 'var(--paw-color-surface-subtle)',
        },
        text: {
          primary: 'var(--paw-color-text-primary)',
          secondary: 'var(--paw-color-text-secondary)',
          muted: 'var(--paw-color-text-muted)',
        },
        border: {
          DEFAULT: 'var(--paw-color-border)',
          subtle: 'var(--paw-color-border-subtle)',
        },
        action: {
          primary: 'var(--paw-color-action-primary)',
          hover: 'var(--paw-color-action-primary-hover)',
          foreground: 'var(--paw-color-action-primary-foreground)',
        },
        destructive: 'var(--paw-color-destructive)',
        warning: 'var(--paw-color-warning)',
        success: 'var(--paw-color-success)',
        focusRing: 'var(--paw-color-focus-ring)',
      },
      borderRadius: {
        none: '0px',
        sm: 'var(--paw-radius-sm, 0.25rem)',
        md: 'var(--paw-radius-md, 0.375rem)',
        lg: 'var(--paw-radius-lg, 0.5rem)',
        xl: 'var(--paw-radius-xl, 0.75rem)',
        full: '9999px',
      },
      spacing: {
        touch: '44px', // Ergonomic 44pt touch targets on mobile
      },
    },
  },
  plugins: [],
};

export default config;
