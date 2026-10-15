import { describe, it, expect } from 'vitest';
import { decodeBmp } from './bmp';

// Helpers build minimal, valid BMP byte buffers so we can assert the decoder
// against known pixels across the encodings real Winamp skins use.

type RGB = [number, number, number];

function writeHeaders(
  dv: DataView,
  buf: Uint8Array,
  width: number,
  height: number,
  bitCount: number,
  compression: number,
  pixelOffset: number,
): void {
  buf[0] = 0x42;
  buf[1] = 0x4d;
  dv.setUint32(2, buf.length, true);
  dv.setUint32(10, pixelOffset, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, width, true);
  dv.setInt32(22, height, true); // negative height => top-down
  dv.setUint16(26, 1, true);
  dv.setUint16(28, bitCount, true);
  dv.setUint32(30, compression, true);
}

/** 24-bit uncompressed. `pixels[y][x]`, y=0 is the top row. */
function bmp24(width: number, height: number, pixels: RGB[][], topDown = false): Uint8Array {
  const rowSize = (((width * 24 + 31) >> 5) << 2);
  const pixelOffset = 54;
  const buf = new Uint8Array(pixelOffset + rowSize * height);
  const dv = new DataView(buf.buffer);
  writeHeaders(dv, buf, width, topDown ? -height : height, 24, 0, pixelOffset);
  for (let s = 0; s < height; s++) {
    const y = topDown ? s : height - 1 - s;
    let o = pixelOffset + s * rowSize;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixels[y]![x]!;
      buf[o++] = b;
      buf[o++] = g;
      buf[o++] = r;
    }
  }
  return buf;
}

/** 8-bit paletted, uncompressed. `indices[y][x]`, y=0 top. */
function bmp8(width: number, height: number, palette: RGB[], indices: number[][]): Uint8Array {
  const rowSize = (((width * 8 + 31) >> 5) << 2);
  const pixelOffset = 54 + palette.length * 4;
  const buf = new Uint8Array(pixelOffset + rowSize * height);
  const dv = new DataView(buf.buffer);
  writeHeaders(dv, buf, width, height, 8, 0, pixelOffset);
  dv.setUint32(46, palette.length, true);
  palette.forEach(([r, g, b], i) => {
    const o = 54 + i * 4;
    buf[o] = b;
    buf[o + 1] = g;
    buf[o + 2] = r;
  });
  for (let s = 0; s < height; s++) {
    const y = height - 1 - s;
    let o = pixelOffset + s * rowSize;
    for (let x = 0; x < width; x++) buf[o++] = indices[y]![x]!;
  }
  return buf;
}

/** 16-bit X1R5G5B5, uncompressed. */
function bmp16(width: number, height: number, pixels: RGB[][]): Uint8Array {
  const rowSize = (((width * 16 + 31) >> 5) << 2);
  const pixelOffset = 54;
  const buf = new Uint8Array(pixelOffset + rowSize * height);
  const dv = new DataView(buf.buffer);
  writeHeaders(dv, buf, width, height, 16, 0, pixelOffset);
  for (let s = 0; s < height; s++) {
    const y = height - 1 - s;
    let o = pixelOffset + s * rowSize;
    for (let x = 0; x < width; x++, o += 2) {
      const [r, g, b] = pixels[y]![x]!;
      const v = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      dv.setUint16(o, v, true);
    }
  }
  return buf;
}

function pixelAt(img: ReturnType<typeof decodeBmp>, x: number, y: number): RGB {
  const i = (y * img.width + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
}

const RED: RGB = [255, 0, 0];
const GREEN: RGB = [0, 255, 0];
const BLUE: RGB = [0, 0, 255];
const WHITE: RGB = [255, 255, 255];

describe('decodeBmp', () => {
  it('decodes a 24-bit bottom-up image with correct orientation', () => {
    const img = decodeBmp(bmp24(2, 2, [[RED, GREEN], [BLUE, WHITE]]));
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(pixelAt(img, 0, 0)).toEqual(RED);
    expect(pixelAt(img, 1, 0)).toEqual(GREEN);
    expect(pixelAt(img, 0, 1)).toEqual(BLUE);
    expect(pixelAt(img, 1, 1)).toEqual(WHITE);
  });

  it('handles top-down images (negative height)', () => {
    const img = decodeBmp(bmp24(2, 2, [[RED, GREEN], [BLUE, WHITE]], true));
    expect(pixelAt(img, 0, 0)).toEqual(RED);
    expect(pixelAt(img, 1, 1)).toEqual(WHITE);
  });

  it('decodes 8-bit paletted images', () => {
    const img = decodeBmp(bmp8(2, 2, [RED, GREEN, BLUE], [[0, 1], [2, 0]]));
    expect(pixelAt(img, 0, 0)).toEqual(RED);
    expect(pixelAt(img, 1, 0)).toEqual(GREEN);
    expect(pixelAt(img, 0, 1)).toEqual(BLUE);
  });

  it('decodes 16-bit 555 images (channels scaled to 0..255)', () => {
    const img = decodeBmp(bmp16(1, 1, [[[255, 0, 0]]]));
    expect(pixelAt(img, 0, 0)).toEqual([255, 0, 0]);
  });

  it('decodes an 8-bit RLE8 stream (encoded run, EOL, absolute, EOB)', () => {
    // 4x2, palette: 0=red 1=green 2=blue. Bottom scanline stored first.
    // Row (bottom, y=1): absolute run of 4 -> [green, blue, green, blue]
    // Row (top,    y=0): encoded run 4x red
    const palette: RGB[] = [RED, GREEN, BLUE];
    const pixelOffset = 54 + palette.length * 4;
    const stream = [
      0x00, 0x04, 1, 2, 1, 2, // absolute: 4 pixels (padded to 4 bytes, already even)
      0x00, 0x00, // end of line
      0x04, 0x00, // encoded: 4 x index 0 (red)
      0x00, 0x01, // end of bitmap
    ];
    const buf = new Uint8Array(pixelOffset + stream.length);
    const dv = new DataView(buf.buffer);
    writeHeaders(dv, buf, 4, 2, 8, 1 /* BI_RLE8 */, pixelOffset);
    dv.setUint32(46, palette.length, true);
    palette.forEach(([r, g, b], i) => {
      const o = 54 + i * 4;
      buf[o] = b;
      buf[o + 1] = g;
      buf[o + 2] = r;
    });
    stream.forEach((v, i) => (buf[pixelOffset + i] = v));

    const img = decodeBmp(buf);
    expect(img.width).toBe(4);
    expect(img.height).toBe(2);
    expect(pixelAt(img, 0, 0)).toEqual(RED); // top row, encoded run
    expect(pixelAt(img, 3, 0)).toEqual(RED);
    expect(pixelAt(img, 0, 1)).toEqual(GREEN); // bottom row, absolute
    expect(pixelAt(img, 1, 1)).toEqual(BLUE);
  });

  it('throws on non-BMP input', () => {
    expect(() => decodeBmp(new Uint8Array([1, 2, 3, 4]))).toThrow(/BMP/);
  });
});
