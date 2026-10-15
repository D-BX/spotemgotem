// The three shipped themes. Only colors differ between them; the radii, font, and
// scale tokens are shared. The `dark` theme's values are exactly the palette the
// app used before the theme engine, so the default look is unchanged.

import type { Theme, ThemeTokens } from './tokens';

export const DEFAULT_THEME_ID = 'dark';

// Non-color tokens are identical across the built-ins.
const SCALE = {
  'radius-sm': '0.25rem',
  'radius-md': '0.5rem',
  'radius-lg': '2rem',
  'font-sans': 'system-ui, sans-serif',
  'fs-xs': '0.75rem',
  'fs-sm': '0.8rem',
  'fs-smd': '0.85rem',
  'fs-md': '0.9rem',
  'fs-base': '1rem',
  'fs-lg': '2rem',
  'sp-1': '0.25rem',
  'sp-2': '0.35rem',
  'sp-3': '0.5rem',
  'sp-4': '0.75rem',
  'sp-5': '1rem',
  'sp-6': '1.5rem',
  'sp-7': '2rem',
} as const;

const darkTokens: ThemeTokens = {
  bg: '#000000',
  'bg-sidebar': '#0b0b0b',
  'bg-player': '#111111',
  'bg-card': '#121212',
  border: '#1e1e1e',
  'border-input': '#333333',
  text: '#eeeeee',
  'text-secondary': '#cccccc',
  'text-section': '#bbbbbb',
  'text-muted': '#888888',
  'text-subtle': '#99aaaa',
  'text-disabled': '#666666',
  accent: '#8a2be2',
  'accent-2': '#4b0082',
  'error-bg': '#2a0d0d',
  'error-border': '#c0392b',
  'error-text': '#f5b7b1',
  warning: '#e67e22',
  ...SCALE,
};

const lightTokens: ThemeTokens = {
  bg: '#ffffff',
  'bg-sidebar': '#f4f4f5',
  'bg-player': '#ececed',
  'bg-card': '#f0f0f1',
  border: '#dddddd',
  'border-input': '#c4c4c6',
  text: '#1a1a1a',
  'text-secondary': '#333333',
  'text-section': '#555555',
  'text-muted': '#6b6b6b',
  'text-subtle': '#5a6a6a',
  'text-disabled': '#999999',
  accent: '#7b1fa2',
  'accent-2': '#4a148c',
  'error-bg': '#fdecea',
  'error-border': '#c0392b',
  'error-text': '#8a1f14',
  warning: '#b05a00',
  ...SCALE,
};

const highContrastTokens: ThemeTokens = {
  bg: '#000000',
  'bg-sidebar': '#000000',
  'bg-player': '#000000',
  'bg-card': '#000000',
  border: '#ffffff',
  'border-input': '#ffffff',
  text: '#ffffff',
  'text-secondary': '#ffffff',
  'text-section': '#ffff00',
  'text-muted': '#e0e0e0',
  'text-subtle': '#d0d0d0',
  'text-disabled': '#bdbdbd',
  accent: '#ffff00',
  'accent-2': '#00e5ff',
  'error-bg': '#000000',
  'error-border': '#ff5555',
  'error-text': '#ff8a8a',
  warning: '#ffcc00',
  ...SCALE,
};

export const BUILTIN_THEMES: Theme[] = [
  { id: 'dark', name: 'Dark', builtin: true, tokens: darkTokens },
  { id: 'light', name: 'Light', builtin: true, tokens: lightTokens },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    builtin: true,
    tokens: highContrastTokens,
  },
];
