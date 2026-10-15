// The built-in procedural skin. It needs no imported assets and is used both for
// zero-import "classic mode" and as a per-sheet fallback when an imported .wsz is
// missing a particular .bmp. Everything here is pure pixel math (no DOM), so the
// skin parser's fallback path stays unit-testable in plain Node.
//
// The sheets are drawn as flat Winamp-ish dark-metal rectangles at their canonical
// dimensions and sliced by the same sprite rects as a real skin, so draw.ts treats
// the default and an imported skin identically — with one exception: `text.bmp` is
// not a real glyph font here, so `proceduralText` is set and the renderer paints the
// song title with a system font instead of blitting bitmap characters.

import type { DecodedImage } from './bmp';
import { DEFAULT_PLEDIT, type Rgb } from './parseText';
import {
  SHEET_DIMENSIONS,
  SHEET_NAMES,
  type SheetName,
  type Skin,
} from './types';
import { DIGIT_WIDTH, DIGIT_HEIGHT } from './sprites';

type Color = readonly [number, number, number];

// A muted, late-90s player palette.
const METAL_DARK: Color = [28, 28, 34];
const METAL_MID: Color = [46, 46, 54];
const METAL_LIGHT: Color = [70, 70, 82];
const ACCENT: Color = [64, 160, 96]; // Winamp-ish green
const LCD_BG: Color = [8, 14, 10];
const LCD_ON: Color = [0, 230, 120];
const LCD_OFF: Color = [0, 48, 28];
const INK: Color = [210, 214, 222];

function blankImage(width: number, height: number): DecodedImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255; // opaque
  return { width, height, data };
}

function fillRect(
  img: DecodedImage,
  x: number,
  y: number,
  w: number,
  h: number,
  [r, g, b]: Color,
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(img.width, x + w);
  const y1 = Math.min(img.height, y + h);
  for (let py = y0; py < y1; py++) {
    let o = (py * img.width + x0) * 4;
    for (let px = x0; px < x1; px++) {
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
      o += 4;
    }
  }
}

/** A flat panel with a 1px light top/left + dark bottom/right bevel. */
function bevel(img: DecodedImage, x: number, y: number, w: number, h: number, face: Color): void {
  fillRect(img, x, y, w, h, face);
  fillRect(img, x, y, w, 1, METAL_LIGHT);
  fillRect(img, x, y, 1, h, METAL_LIGHT);
  fillRect(img, x, y + h - 1, w, 1, METAL_DARK);
  fillRect(img, x + w - 1, y, 1, h, METAL_DARK);
}

// --- Seven-segment digits (so the default LCD shows readable time) ----------
// numbers.bmp lays out digits 0..9 left-to-right at 9px pitch, each 9x13.
// Segment layout per cell (a top, b top-right, c bottom-right, d bottom,
// e bottom-left, f top-left, g middle).
const SEGMENTS: Record<number, string> = {
  0: 'abcdef',
  1: 'bc',
  2: 'abged',
  3: 'abgcd',
  4: 'fgbc',
  5: 'afgcd',
  6: 'afgedc',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcfgd',
};

function drawSevenSegment(img: DecodedImage, ox: number, d: number): void {
  const segs = SEGMENTS[d] ?? '';
  const on = segs.split('');
  const t = 2; // segment thickness
  const w = DIGIT_WIDTH; // 9
  const h = DIGIT_HEIGHT; // 13
  const pad = 1;
  const midY = Math.floor(h / 2) - 1;
  const paint = (seg: string, x: number, y: number, sw: number, sh: number): void => {
    fillRect(img, ox + x, y, sw, sh, on.includes(seg) ? LCD_ON : LCD_OFF);
  };
  // horizontals
  paint('a', pad + 1, pad, w - 2 * pad - 2, t);
  paint('g', pad + 1, midY, w - 2 * pad - 2, t);
  paint('d', pad + 1, h - pad - t, w - 2 * pad - 2, t);
  // verticals
  paint('f', pad, pad + 1, t, midY - pad - 1);
  paint('b', w - pad - t, pad + 1, t, midY - pad - 1);
  paint('e', pad, midY + t, t, h - pad - t - (midY + t));
  paint('c', w - pad - t, midY + t, t, h - pad - t - (midY + t));
}

function buildNumbers(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, LCD_BG);
  for (let d = 0; d <= 9; d++) drawSevenSegment(img, d * DIGIT_WIDTH, d);
  return img;
}

// --- Per-sheet procedural painters ------------------------------------------

function buildMain(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_MID);
  // Title bar strip.
  fillRect(img, 0, 0, width, 14, METAL_DARK);
  fillRect(img, 0, 14, width, 1, METAL_LIGHT);
  // LCD display region (time + title live here in draw.ts).
  bevel(img, 24, 24, 150, 18, LCD_BG);
  // Visualizer well (left blank/dark; M6 fills it).
  bevel(img, 24, 43, 76, 16, [12, 12, 16]);
  // Transport button row background.
  bevel(img, 16, 86, 115, 20, METAL_LIGHT);
  // Position bar groove.
  bevel(img, 16, 72, 248, 10, METAL_DARK);
  return img;
}

function buildTitlebar(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_DARK);
  // Active bar (sprite TITLEBAR.barSelected at 27,0) + inactive (27,15).
  fillRect(img, 27, 0, 275, 14, METAL_LIGHT);
  fillRect(img, 27, 15, 275, 14, METAL_MID);
  // Little window control glyphs.
  fillRect(img, 0, 0, 9, 9, ACCENT);
  fillRect(img, 9, 0, 9, 9, ACCENT);
  fillRect(img, 18, 0, 9, 9, ACCENT);
  return img;
}

/** Draw a row of flat buttons with a bevel; used for cbuttons/shufrep faces. */
function buildButtonSheet(width: number, height: number, cols: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_DARK);
  const bw = Math.floor(width / cols);
  for (let c = 0; c < cols; c++) {
    bevel(img, c * bw, 0, bw - 1, Math.min(18, height), METAL_LIGHT);
    if (height > 18) bevel(img, c * bw, 18, bw - 1, height - 18, METAL_MID);
  }
  return img;
}

function buildPosbar(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, 248, height, METAL_DARK);
  // Two thumb sprites at x=248 and x=278.
  bevel(img, 248, 0, 29, 10, ACCENT);
  bevel(img, 278, 0, 29, 10, METAL_LIGHT);
  return img;
}

function buildSlider(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  // Background frames (stacked) in the top region.
  fillRect(img, 0, 0, width, 420, METAL_DARK);
  for (let y = 0; y < 420; y += 15) fillRect(img, 2, y + 6, width - 4, 2, ACCENT);
  // Two thumb sprites in the strip near y=422.
  bevel(img, 0, 422, 14, 11, METAL_LIGHT);
  bevel(img, 15, 422, 14, 11, ACCENT);
  return img;
}

function buildMonoster(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_DARK);
  // Selected (lit) row at y=0, inactive row at y=12.
  fillRect(img, 0, 0, 29, 12, ACCENT); // stereo lit
  fillRect(img, 29, 0, 27, 12, ACCENT); // mono lit
  fillRect(img, 0, 12, 29, 12, METAL_MID);
  fillRect(img, 29, 12, 27, 12, METAL_MID);
  return img;
}

function buildPlaypaus(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, LCD_BG);
  // Indicator glyphs at 0/9/18/36; "working" strip at 39.
  fillRect(img, 0, 0, 9, 9, LCD_ON);
  fillRect(img, 9, 0, 9, 9, LCD_ON);
  fillRect(img, 18, 0, 9, 9, LCD_OFF);
  fillRect(img, 36, 0, 3, 9, LCD_OFF);
  fillRect(img, 39, 0, 3, 9, LCD_ON);
  return img;
}

function buildText(width: number, height: number): DecodedImage {
  // Not a usable glyph font — just a dark strip. `proceduralText` makes draw.ts
  // paint the title with a system font instead of slicing this sheet.
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_DARK);
  return img;
}

function buildPledit(width: number, height: number): DecodedImage {
  const img = blankImage(width, height);
  fillRect(img, 0, 0, width, height, METAL_MID);
  // Title bar + frame edges so the classic playlist has some chrome.
  fillRect(img, 0, 0, width, 20, METAL_DARK);
  fillRect(img, 0, height - 38, width, 38, METAL_DARK);
  return img;
}

function buildSheet(name: SheetName): DecodedImage {
  const [w, h] = SHEET_DIMENSIONS[name];
  switch (name) {
    case 'main':
      return buildMain(w, h);
    case 'titlebar':
      return buildTitlebar(w, h);
    case 'cbuttons':
      return buildButtonSheet(w, h, 5);
    case 'monoster':
      return buildMonoster(w, h);
    case 'playpaus':
      return buildPlaypaus(w, h);
    case 'posbar':
      return buildPosbar(w, h);
    case 'volume':
    case 'balance':
      return buildSlider(w, h);
    case 'shufrep':
      return buildButtonSheet(w, h, 2);
    case 'numbers':
      return buildNumbers(w, h);
    case 'text':
      return buildText(w, h);
    case 'pledit':
      return buildPledit(w, h);
    default: {
      // Exhaustiveness guard: every SheetName must be handled above.
      const _never: never = name;
      return _never;
    }
  }
}

/** The default 24-entry visualizer palette (dark→green ramp, red peaks). */
function defaultViscolor(): Rgb[] {
  const colors: Rgb[] = [];
  colors.push([0, 0, 0]); // 0: background
  colors.push([24, 24, 24]); // 1: grid dots
  for (let i = 0; i < 16; i++) {
    // 2..17: spectrum bars, green→yellow ramp.
    const t = i / 15;
    colors.push([Math.round(40 + t * 200), 200, Math.round(80 * (1 - t))]);
  }
  for (let i = 0; i < 5; i++) colors.push([200, 60, 40]); // 18..22: osc / peaks
  colors.push([255, 255, 255]); // 23: peak cap
  return colors.slice(0, 24);
}

/** Build the complete procedural skin. Pure; safe to call in Node. */
export function createDefaultSkin(): Skin {
  const sheets = {} as Record<SheetName, DecodedImage>;
  for (const name of SHEET_NAMES) sheets[name] = buildSheet(name);
  return {
    id: 'default',
    name: 'Default (built-in)',
    sheets,
    viscolor: defaultViscolor(),
    pledit: DEFAULT_PLEDIT,
    proceduralText: true,
  };
}

export { INK }; // exported for draw.ts title color parity
