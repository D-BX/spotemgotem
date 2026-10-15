// Reactive theme state plus the DOM side effect that makes a theme visible.
// `themes` holds the built-ins followed by any user-imported custom themes; the
// active theme's tokens are written as `--<token>` custom properties on the
// document root. Active id and custom themes persist in localStorage.

import { createSignal } from 'solid-js';
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './builtins';
import { TOKEN_NAMES, type Theme, type ThemeTokens } from './tokens';

const ACTIVE_KEY = 'spotemgotem.theme.active';
const CUSTOM_KEY = 'spotemgotem.theme.custom';

const [themes, setThemes] = createSignal<Theme[]>(BUILTIN_THEMES);
const [activeThemeId, setActiveThemeId] = createSignal<string>(DEFAULT_THEME_ID);

export { themes, activeThemeId };

function findTheme(id: string): Theme | undefined {
  return themes().find((t) => t.id === id);
}

/** Write every token as a `--<name>` custom property on the document root. */
function applyTokens(tokens: ThemeTokens): void {
  const root = document.documentElement;
  for (const name of TOKEN_NAMES) {
    root.style.setProperty(`--${name}`, tokens[name]);
  }
}

function persistCustom(): void {
  const custom = themes().filter((t) => !t.builtin);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
}

/** Switch the active theme and persist the choice. No-op if the id is unknown. */
export function setActiveTheme(id: string): void {
  const theme = findTheme(id);
  if (!theme) return;
  applyTokens(theme.tokens);
  setActiveThemeId(id);
  localStorage.setItem(ACTIVE_KEY, id);
}

/** Add an imported theme to the library, persist it, and make it active. */
export function addCustomTheme(theme: Theme): void {
  setThemes((prev) => [...prev, theme]);
  persistCustom();
  setActiveTheme(theme.id);
}

/** Remove a custom theme. If it was active, fall back to the default theme. */
export function removeCustomTheme(id: string): void {
  const theme = findTheme(id);
  if (!theme || theme.builtin) return;
  setThemes((prev) => prev.filter((t) => t.id !== id));
  persistCustom();
  if (activeThemeId() === id) setActiveTheme(DEFAULT_THEME_ID);
}

/** Serialize a theme as pretty JSON (name + tokens only) for export/download. */
export function exportThemeJson(id: string): string {
  const theme = findTheme(id);
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return JSON.stringify({ name: theme.name, tokens: theme.tokens }, null, 2);
}

/** Load persisted custom themes + active id and apply the active theme. Call this
 *  once before rendering so the first paint is already themed. */
export function initThemes(): void {
  let custom: Theme[] = [];
  try {
    const stored = localStorage.getItem(CUSTOM_KEY);
    if (stored) custom = JSON.parse(stored) as Theme[];
  } catch {
    // Corrupt custom-theme storage is non-fatal; ignore and use built-ins only.
    custom = [];
  }
  if (custom.length > 0) setThemes([...BUILTIN_THEMES, ...custom]);

  const storedActive = localStorage.getItem(ACTIVE_KEY);
  const activeId = storedActive && findTheme(storedActive) ? storedActive : DEFAULT_THEME_ID;
  setActiveTheme(activeId);
}
