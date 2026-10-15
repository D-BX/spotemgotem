// The canonical theme token vocabulary. A theme is a complete map from these
// token names to CSS values; the theme store writes each one as a `--<name>`
// custom property on the document root, and components read them via `var(--...)`.
// Token names double as the CSS custom-property names (without the leading `--`).

export const TOKEN_NAMES = [
  // Colors
  'bg',
  'bg-sidebar',
  'bg-player',
  'bg-card',
  'border',
  'border-input',
  'text',
  'text-secondary',
  'text-section',
  'text-muted',
  'text-subtle',
  'text-disabled',
  'accent',
  'accent-2',
  'error-bg',
  'error-border',
  'error-text',
  'warning',
  // Radii
  'radius-sm',
  'radius-md',
  'radius-lg',
  // Font family
  'font-sans',
  // Font sizes
  'fs-xs',
  'fs-sm',
  'fs-smd',
  'fs-md',
  'fs-base',
  'fs-lg',
  // Spacing scale
  'sp-1',
  'sp-2',
  'sp-3',
  'sp-4',
  'sp-5',
  'sp-6',
  'sp-7',
] as const;

export type ThemeTokenName = (typeof TOKEN_NAMES)[number];

/** A complete set of token values. Every token is required. */
export type ThemeTokens = Record<ThemeTokenName, string>;

export interface Theme {
  id: string;
  name: string;
  /** True for the shipped themes, false for user-imported ones. */
  builtin: boolean;
  tokens: ThemeTokens;
}
