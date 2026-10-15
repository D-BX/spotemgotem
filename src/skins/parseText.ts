// Parsers for the plain-text files inside a .wsz skin:
//   viscolor.txt — 24 RGB entries that colour the visualizer (used in M6).
//   pledit.txt   — colours + font for the classic playlist window.
//   region.txt   — optional non-rectangular window regions (stored raw for now).

export type Rgb = [number, number, number];

export interface PleditColors {
  normal: string; // track text
  current: string; // currently-playing track text
  normalBg: string; // background
  selectedBg: string; // selected row background
  font: string; // font family name (informational)
}

export const DEFAULT_PLEDIT: PleditColors = {
  normal: '#00ff00',
  current: '#ffffff',
  normalBg: '#000000',
  selectedBg: '#0000c6',
  font: 'Arial',
};

function clampByte(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(255, Math.max(0, Math.trunc(n)));
}

/**
 * Parse viscolor.txt into exactly 24 RGB triples. Each meaningful line looks
 * like `255,255,255 // comment`. Short files are padded with black; long files
 * are truncated, so callers can always index 0..23 safely.
 */
export function parseViscolor(text: string): Rgb[] {
  const colors: Rgb[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const match = line.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (!match) continue;
    colors.push([clampByte(+match[1]!), clampByte(+match[2]!), clampByte(+match[3]!)]);
    if (colors.length === 24) break;
  }
  while (colors.length < 24) colors.push([0, 0, 0]);
  return colors;
}

/** Normalise a pledit colour value (`#RGB`, `#RRGGBB`, or bare hex) to #rrggbb. */
function normalizeColor(value: string, fallback: string): string {
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  return `#${hex.toLowerCase()}`;
}

/**
 * Parse pledit.txt. It is an INI-ish file with a `[Text]` section; keys are
 * matched case-insensitively and `//`-comments / blank lines are ignored.
 */
export function parsePledit(text: string): PleditColors {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('[') || line.startsWith('//') || line.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim();
    values[key] = val;
  }
  return {
    normal: values.normal ? normalizeColor(values.normal, DEFAULT_PLEDIT.normal) : DEFAULT_PLEDIT.normal,
    current: values.current ? normalizeColor(values.current, DEFAULT_PLEDIT.current) : DEFAULT_PLEDIT.current,
    normalBg: values.normalbg ? normalizeColor(values.normalbg, DEFAULT_PLEDIT.normalBg) : DEFAULT_PLEDIT.normalBg,
    selectedBg: values.selectedbg ? normalizeColor(values.selectedbg, DEFAULT_PLEDIT.selectedBg) : DEFAULT_PLEDIT.selectedBg,
    font: values.font ?? DEFAULT_PLEDIT.font,
  };
}
