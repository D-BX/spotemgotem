// Sprite coordinates for the classic Winamp main window. These rectangles are
// ported from Webamp's `skinSprites.ts` (github.com/captbaritone/webamp, MIT) —
// used here as a coordinate reference only, not as a dependency. The placement
// coordinates (where each sprite is drawn on the 275x116 main window) follow the
// classic Winamp 2.x layout.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

// --- Source sprite sheets (sx, sy, w, h within each .bmp) -----------------

export const CBUTTONS = {
  prev: r(0, 0, 23, 18),
  prevActive: r(0, 18, 23, 18),
  play: r(23, 0, 23, 18),
  playActive: r(23, 18, 23, 18),
  pause: r(46, 0, 23, 18),
  pauseActive: r(46, 18, 23, 18),
  stop: r(69, 0, 23, 18),
  stopActive: r(69, 18, 23, 18),
  next: r(92, 0, 23, 18),
  nextActive: r(92, 18, 22, 18),
  eject: r(114, 0, 22, 16),
  ejectActive: r(114, 16, 22, 16),
} as const;

export const TITLEBAR = {
  bar: r(27, 15, 275, 14),
  barSelected: r(27, 0, 275, 14),
  optionsButton: r(0, 0, 9, 9),
  optionsButtonDown: r(0, 9, 9, 9),
  minimizeButton: r(9, 0, 9, 9),
  minimizeButtonDown: r(9, 9, 9, 9),
  shadeButton: r(0, 18, 9, 9),
  shadeButtonDown: r(9, 18, 9, 9),
  closeButton: r(18, 0, 9, 9),
  closeButtonDown: r(18, 9, 9, 9),
} as const;

export const MONOSTER = {
  stereo: r(0, 12, 29, 12),
  stereoSelected: r(0, 0, 29, 12),
  mono: r(29, 12, 27, 12),
  monoSelected: r(29, 0, 27, 12),
} as const;

export const PLAYPAUS = {
  playing: r(0, 0, 9, 9),
  paused: r(9, 0, 9, 9),
  stopped: r(18, 0, 9, 9),
  notWorking: r(36, 0, 9, 9),
  working: r(39, 0, 3, 9),
} as const;

export const POSBAR = {
  background: r(0, 0, 248, 10),
  thumb: r(248, 0, 29, 10),
  thumbSelected: r(278, 0, 29, 10),
} as const;

export const VOLUME = {
  background: r(0, 0, 68, 420), // 28 frames stacked (each 68x13 at y = i*15)
  thumb: r(15, 422, 14, 11),
  thumbSelected: r(0, 422, 14, 11),
} as const;

export const BALANCE = {
  background: r(9, 0, 38, 420),
  thumb: r(15, 422, 14, 11),
  thumbSelected: r(0, 422, 14, 11),
} as const;

export const SHUFREP = {
  shuffle: r(28, 0, 47, 15),
  shuffleDown: r(28, 15, 47, 15),
  shuffleSelected: r(28, 30, 47, 15),
  shuffleSelectedDown: r(28, 45, 47, 15),
  repeat: r(0, 0, 28, 15),
  repeatDown: r(0, 15, 28, 15),
  repeatSelected: r(0, 30, 28, 15),
  repeatSelectedDown: r(0, 45, 28, 15),
} as const;

/** Digit sprites. numbers.bmp lays digits out left-to-right at 9px pitch. */
export const DIGIT_WIDTH = 9;
export const DIGIT_HEIGHT = 13;
export function digitRect(d: number): Rect {
  return r(d * DIGIT_WIDTH, 0, DIGIT_WIDTH, DIGIT_HEIGHT);
}

// --- Main-window placement (where to draw on the 275x116 face) ------------

export const MAIN_WIDTH = 275;
export const MAIN_HEIGHT = 116;

export const PLACE = {
  titleBar: { x: 0, y: 0 },
  prev: { x: 16, y: 88 },
  play: { x: 39, y: 88 },
  pause: { x: 62, y: 88 },
  stop: { x: 85, y: 88 },
  next: { x: 108, y: 88 },
  eject: { x: 136, y: 89 },
  posBar: { x: 16, y: 72 }, // track; thumb travels 0..(248-29)
  volume: { x: 107, y: 57 }, // 68 wide; thumb travels 0..(68-14)
  balance: { x: 177, y: 57 }, // 38 wide
  mono: { x: 212, y: 41 },
  stereo: { x: 239, y: 41 },
  shuffle: { x: 164, y: 89 },
  repeat: { x: 210, y: 89 },
  playIndicator: { x: 24, y: 28 },
  // Four time digits + leading minus slot, all at y: 26.
  minus: { x: 36, y: 26 },
  timeDigits: [
    { x: 48, y: 26 },
    { x: 60, y: 26 },
    { x: 78, y: 26 },
    { x: 90, y: 26 },
  ],
  // Scrolling song title, drawn with the bitmap font.
  title: { x: 111, y: 27, w: 153 },
} as const;

export const POSBAR_THUMB_TRAVEL = POSBAR.background.w - POSBAR.thumb.w; // 219
export const VOLUME_THUMB_TRAVEL = 68 - VOLUME.thumb.w; // 54
export const BALANCE_THUMB_TRAVEL = 38 - BALANCE.thumb.w; // 24

// --- Bitmap font (text.bmp) ------------------------------------------------
// Classic Winamp text.bmp is a grid of 5x6 glyphs, 31 columns per row, 3 rows.
// Map each supported character to its [column, row]. Unknown characters render
// as a space. Lowercase is folded to uppercase before lookup.

export const CHAR_W = 5;
export const CHAR_H = 6;

const ROW0 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ"@ ';
const ROW1 = '0123456789\u2026.:()-\'!_+\\/[]^&%,=$#';
const ROW2 = '\u00c5\u00d6\u00c4?*';

const TEXT_MAP: Record<string, [number, number]> = {};
for (let i = 0; i < ROW0.length; i++) TEXT_MAP[ROW0[i]!] = [i, 0];
for (let i = 0; i < ROW1.length; i++) TEXT_MAP[ROW1[i]!] = [i, 1];
for (let i = 0; i < ROW2.length; i++) TEXT_MAP[ROW2[i]!] = [i, 2];

export function charRect(ch: string): Rect {
  const upper = ch.toUpperCase();
  const cell = TEXT_MAP[upper] ?? TEXT_MAP[' ']!;
  return r(cell[0] * CHAR_W, cell[1] * CHAR_H, CHAR_W, CHAR_H);
}
