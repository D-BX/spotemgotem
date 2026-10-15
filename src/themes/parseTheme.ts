// Validates and normalizes imported theme JSON. A valid theme must have a string
// `name` and a `tokens` object containing every token in TOKEN_NAMES with a string
// value. Anything else throws a descriptive error — we never silently fill in
// defaults for a malformed import.

import { TOKEN_NAMES, type Theme, type ThemeTokens } from './tokens';

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'theme'}-${suffix}`;
}

/** Parse a theme JSON string into a normalized, id-stamped custom Theme. */
export function parseThemeJson(text: string): Theme {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Theme must be a JSON object.');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error('Theme is missing a non-empty "name" string.');
  }

  if (typeof obj.tokens !== 'object' || obj.tokens === null) {
    throw new Error('Theme is missing a "tokens" object.');
  }
  const rawTokens = obj.tokens as Record<string, unknown>;

  const missing: string[] = [];
  const nonString: string[] = [];
  const tokens = {} as ThemeTokens;
  for (const name of TOKEN_NAMES) {
    const value = rawTokens[name];
    if (value === undefined) {
      missing.push(name);
    } else if (typeof value !== 'string') {
      nonString.push(name);
    } else {
      tokens[name] = value;
    }
  }

  if (missing.length > 0 || nonString.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing tokens: ${missing.join(', ')}`);
    if (nonString.length > 0) parts.push(`non-string tokens: ${nonString.join(', ')}`);
    throw new Error(`Invalid theme — ${parts.join('; ')}.`);
  }

  return {
    id: slugify(obj.name),
    name: obj.name.trim(),
    builtin: false,
    tokens,
  };
}
