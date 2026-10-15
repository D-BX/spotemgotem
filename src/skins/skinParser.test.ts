import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { parseSkin } from './skinParser';
import { SHEET_DIMENSIONS, SHEET_NAMES } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, '../../fixtures/skins');

const FIXTURES = [
  'base-2.91.wsz', // 8bpp BI_RLE8 — forces real RLE support
  'Zelda_Amp_3.wsz',
  'ed2.wsz', // 16bpp text/titlebar
  'soundcheck1.wsz',
  'Cowboy_Bebop_-_Jet_Black.wsz',
];

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(fixturesDir, name)));
}

describe('parseSkin — real fixtures', () => {
  for (const fixture of FIXTURES) {
    it(`parses ${fixture} into all 12 sheets`, () => {
      const skin = parseSkin(load(fixture), { name: fixture });
      // Every sheet is present and has non-zero dimensions.
      for (const name of SHEET_NAMES) {
        const sheet = skin.sheets[name];
        expect(sheet.width).toBeGreaterThan(0);
        expect(sheet.height).toBeGreaterThan(0);
        expect(sheet.data.length).toBe(sheet.width * sheet.height * 4);
      }
      // The main face decodes at least to the canonical 275x116.
      const [mw, mh] = SHEET_DIMENSIONS.main;
      expect(skin.sheets.main.width).toBeGreaterThanOrEqual(mw);
      expect(skin.sheets.main.height).toBeGreaterThanOrEqual(mh);
      // viscolor always yields 24 entries.
      expect(skin.viscolor).toHaveLength(24);
      expect(skin.proceduralText).toBe(false);
    });
  }

  it('resolves numbers via numbers.bmp or nums_ex.bmp', () => {
    // Cowboy Bebop & Zelda ship nums_ex.bmp; base ships numbers.bmp.
    for (const fixture of FIXTURES) {
      const skin = parseSkin(load(fixture), { name: fixture });
      expect(skin.sheets.numbers.width).toBeGreaterThan(0);
    }
  });

  it('decodes the RLE8-compressed base skin main sheet with real pixels', () => {
    const skin = parseSkin(load('base-2.91.wsz'));
    const { data } = skin.sheets.main;
    // Not an all-zero buffer — RLE actually produced colored pixels.
    let nonBlack = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] || data[i + 1] || data[i + 2]) nonBlack++;
    }
    expect(nonBlack).toBeGreaterThan(1000);
  });
});

describe('parseSkin — fallbacks', () => {
  it('substitutes the procedural default for missing sheets', () => {
    // A zip containing only main.bmp (a tiny valid BMP) + nothing else.
    const mainBmp = tinyBmp(275, 116);
    const zip = zipSync({
      'MAIN.BMP': mainBmp, // uppercase to exercise case-insensitive match
      'pledit.txt': strToU8('[Text]\nNormal=#abcdef\n'),
    });
    const skin = parseSkin(zip);
    // main came from the zip (case-insensitive), others from the default.
    expect(skin.sheets.main.width).toBe(275);
    expect(skin.sheets.cbuttons.width).toBe(SHEET_DIMENSIONS.cbuttons[0]);
    expect(skin.sheets.volume.height).toBe(SHEET_DIMENSIONS.volume[1]);
    // pledit.txt was honored.
    expect(skin.pledit.normal).toBe('#abcdef');
    // viscolor missing -> default 24.
    expect(skin.viscolor).toHaveLength(24);
  });

  it('throws on non-zip input', () => {
    expect(() => parseSkin(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

/** Build a minimal valid 24-bit BMP of a solid color for fallback tests. */
function tinyBmp(width: number, height: number): Uint8Array {
  const rowSize = (((width * 24 + 31) >> 5) << 2);
  const pixelOffset = 54;
  const buf = new Uint8Array(pixelOffset + rowSize * height);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x42;
  buf[1] = 0x4d;
  dv.setUint32(2, buf.length, true);
  dv.setUint32(10, pixelOffset, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, width, true);
  dv.setInt32(22, height, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(30, 0, true);
  for (let s = 0; s < height; s++) {
    let o = pixelOffset + s * rowSize;
    for (let x = 0; x < width; x++) {
      buf[o++] = 0x40;
      buf[o++] = 0x80;
      buf[o++] = 0x40;
    }
  }
  return buf;
}
