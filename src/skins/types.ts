// The shape of a parsed skin. Sheets are kept as raw RGBA (ImageData-compatible)
// so the parser stays DOM-free and testable; the browser converts them to
// ImageBitmaps for drawing (see skinBitmaps.ts).

import type { DecodedImage } from './bmp';
import type { PleditColors, Rgb } from './parseText';

export type SheetName =
  | 'main'
  | 'titlebar'
  | 'cbuttons'
  | 'monoster'
  | 'playpaus'
  | 'posbar'
  | 'volume'
  | 'balance'
  | 'shufrep'
  | 'numbers'
  | 'text'
  | 'pledit';

export const SHEET_NAMES: readonly SheetName[] = [
  'main', 'titlebar', 'cbuttons', 'monoster', 'playpaus', 'posbar',
  'volume', 'balance', 'shufrep', 'numbers', 'text', 'pledit',
] as const;

/** The .bmp file (lowercase basename) each sheet is sourced from. `numbers`
 *  accepts either numbers.bmp or nums_ex.bmp. */
export const SHEET_FILES: Record<SheetName, string[]> = {
  main: ['main.bmp'],
  titlebar: ['titlebar.bmp'],
  cbuttons: ['cbuttons.bmp'],
  monoster: ['monoster.bmp'],
  playpaus: ['playpaus.bmp'],
  posbar: ['posbar.bmp'],
  volume: ['volume.bmp'],
  balance: ['balance.bmp'],
  shufrep: ['shufrep.bmp'],
  numbers: ['numbers.bmp', 'nums_ex.bmp'],
  text: ['text.bmp'],
  pledit: ['pledit.bmp'],
};

/** Canonical sheet dimensions, used to size the procedural default. */
export const SHEET_DIMENSIONS: Record<SheetName, [number, number]> = {
  main: [275, 116],
  titlebar: [344, 87],
  cbuttons: [136, 36],
  monoster: [56, 24],
  playpaus: [42, 9],
  posbar: [307, 10],
  volume: [68, 433],
  balance: [47, 433],
  shufrep: [92, 85],
  numbers: [108, 13],
  text: [155, 18],
  pledit: [280, 186],
};

export interface Skin {
  id: string;
  name: string;
  sheets: Record<SheetName, DecodedImage>;
  viscolor: Rgb[];
  pledit: PleditColors;
  /** True for the built-in default, whose text.bmp is not a real glyph font —
   *  the renderer draws the song title with a system font instead. */
  proceduralText: boolean;
}
