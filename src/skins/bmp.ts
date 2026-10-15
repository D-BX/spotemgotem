// A small, dependency-free BMP decoder. Winamp skins ship their sprite sheets as
// Windows BMP files in a variety of encodings: most are 24-bit uncompressed, some
// are 16-bit 555, and the classic base skin uses 8-bit RLE-compressed BMPs. The
// browser's createImageBitmap could decode these, but a pure decoder lets the skin
// parser run (and be unit-tested) in plain Node, and gives us raw RGBA to slice
// sprites from. Output is always top-down RGBA, matching ImageData.

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, row-major, top-down, premultiplied-alpha-free
}

const BI_RLE8 = 1;
const BI_RLE4 = 2;
const BI_BITFIELDS = 3;

/** Scale an n-bit channel value to 0..255. */
function scale(value: number, bits: number): number {
  if (bits <= 0) return 0;
  const max = (1 << bits) - 1;
  return Math.round((value * 255) / max);
}

/** Number of low zero bits in a channel mask (its shift). */
function maskShift(mask: number): number {
  if (mask === 0) return 0;
  let shift = 0;
  while ((mask & 1) === 0) {
    mask >>>= 1;
    shift++;
  }
  return shift;
}

/** Number of set bits in a channel mask (its width). */
function maskWidth(mask: number): number {
  let width = 0;
  while (mask !== 0) {
    width += mask & 1;
    mask >>>= 1;
  }
  return width;
}

export function decodeBmp(bytes: Uint8Array): DecodedImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 54 || view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4d) {
    throw new Error('Not a BMP file (missing "BM" signature).');
  }

  const pixelOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
  const bitCount = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (width <= 0 || height <= 0 || width > 1 << 16 || height > 1 << 16) {
    throw new Error(`BMP has implausible dimensions ${width}x${rawHeight}.`);
  }

  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < out.length; i += 4) out[i] = 255; // opaque by default

  const destRow = (storedRow: number): number =>
    topDown ? storedRow : height - 1 - storedRow;

  const putPixel = (x: number, storedRow: number, r: number, g: number, b: number): void => {
    const y = destRow(storedRow);
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  };

  // --- Palette (for <= 8 bpp) --------------------------------------------
  const palette: number[] = []; // flat [r,g,b, r,g,b, ...]
  if (bitCount <= 8) {
    let clrUsed = view.getUint32(46, true);
    if (clrUsed === 0) clrUsed = 1 << bitCount;
    const paletteOffset = 14 + dibSize;
    for (let i = 0; i < clrUsed; i++) {
      const o = paletteOffset + i * 4;
      if (o + 2 >= bytes.length) break;
      palette.push(view.getUint8(o + 2), view.getUint8(o + 1), view.getUint8(o));
    }
  }
  const palR = (idx: number): number => palette[idx * 3] ?? 0;
  const palG = (idx: number): number => palette[idx * 3 + 1] ?? 0;
  const palB = (idx: number): number => palette[idx * 3 + 2] ?? 0;

  // --- RLE-compressed paths ----------------------------------------------
  if (compression === BI_RLE8) {
    decodeRle(bytes, pixelOffset, height, false, putPixel, palR, palG, palB);
    return { width, height, data: out };
  }
  if (compression === BI_RLE4) {
    decodeRle(bytes, pixelOffset, height, true, putPixel, palR, palG, palB);
    return { width, height, data: out };
  }

  // --- Uncompressed paths -------------------------------------------------
  const rowSize = (((width * bitCount + 31) >> 5) << 2); // padded to 4 bytes

  if (bitCount === 24 || bitCount === 32) {
    const step = bitCount / 8;
    for (let s = 0; s < height; s++) {
      let o = pixelOffset + s * rowSize;
      for (let x = 0; x < width; x++, o += step) {
        putPixel(x, s, view.getUint8(o + 2), view.getUint8(o + 1), view.getUint8(o));
      }
    }
  } else if (bitCount === 16) {
    // Default 16-bit layout is X1R5G5B5; honor explicit BITFIELDS masks if present.
    let rMask = 0x7c00;
    let gMask = 0x03e0;
    let bMask = 0x001f;
    if (compression === BI_BITFIELDS) {
      rMask = view.getUint32(54, true);
      gMask = view.getUint32(58, true);
      bMask = view.getUint32(62, true);
    }
    const rShift = maskShift(rMask);
    const gShift = maskShift(gMask);
    const bShift = maskShift(bMask);
    const rBits = maskWidth(rMask);
    const gBits = maskWidth(gMask);
    const bBits = maskWidth(bMask);
    for (let s = 0; s < height; s++) {
      let o = pixelOffset + s * rowSize;
      for (let x = 0; x < width; x++, o += 2) {
        const v = view.getUint16(o, true);
        putPixel(
          x,
          s,
          scale((v & rMask) >>> rShift, rBits),
          scale((v & gMask) >>> gShift, gBits),
          scale((v & bMask) >>> bShift, bBits),
        );
      }
    }
  } else if (bitCount === 8) {
    for (let s = 0; s < height; s++) {
      let o = pixelOffset + s * rowSize;
      for (let x = 0; x < width; x++, o++) {
        const idx = view.getUint8(o);
        putPixel(x, s, palR(idx), palG(idx), palB(idx));
      }
    }
  } else if (bitCount === 4) {
    for (let s = 0; s < height; s++) {
      const base = pixelOffset + s * rowSize;
      for (let x = 0; x < width; x++) {
        const byte = view.getUint8(base + (x >> 1));
        const idx = x & 1 ? byte & 0x0f : byte >> 4;
        putPixel(x, s, palR(idx), palG(idx), palB(idx));
      }
    }
  } else if (bitCount === 1) {
    for (let s = 0; s < height; s++) {
      const base = pixelOffset + s * rowSize;
      for (let x = 0; x < width; x++) {
        const byte = view.getUint8(base + (x >> 3));
        const idx = (byte >> (7 - (x & 7))) & 1;
        putPixel(x, s, palR(idx), palG(idx), palB(idx));
      }
    }
  } else {
    throw new Error(`Unsupported BMP bit depth: ${bitCount}.`);
  }

  return { width, height, data: out };
}

/** Decode an RLE8 or RLE4 pixel stream. RLE BMPs are always stored bottom-up. */
function decodeRle(
  bytes: Uint8Array,
  start: number,
  height: number,
  rle4: boolean,
  putPixel: (x: number, storedRow: number, r: number, g: number, b: number) => void,
  palR: (i: number) => number,
  palG: (i: number) => number,
  palB: (i: number) => number,
): void {
  let p = start;
  let x = 0;
  let y = 0; // stored scanline (0 = bottom)
  const emit = (idx: number): void => putPixel(x++, y, palR(idx), palG(idx), palB(idx));

  while (p + 1 < bytes.length) {
    const count = bytes[p++]!;
    const value = bytes[p++]!;
    if (count > 0) {
      // Encoded run of `count` pixels.
      if (rle4) {
        const hi = value >> 4;
        const lo = value & 0x0f;
        for (let i = 0; i < count; i++) emit(i & 1 ? lo : hi);
      } else {
        for (let i = 0; i < count; i++) emit(value);
      }
    } else {
      // Escape code.
      if (value === 0) {
        x = 0;
        y++;
      } else if (value === 1) {
        break; // end of bitmap
      } else if (value === 2) {
        x += bytes[p++] ?? 0;
        y += bytes[p++] ?? 0;
      } else {
        // Absolute mode: `value` literal pixels follow.
        if (rle4) {
          for (let i = 0; i < value; i++) {
            const byte = bytes[p + (i >> 1)] ?? 0;
            emit(i & 1 ? byte & 0x0f : byte >> 4);
          }
          const bytesRead = (value + 1) >> 1;
          p += bytesRead + (bytesRead & 1); // pad to 16-bit boundary
        } else {
          for (let i = 0; i < value; i++) emit(bytes[p + i] ?? 0);
          p += value + (value & 1); // pad to 16-bit boundary
        }
      }
    }
    if (y >= height) break;
  }
}
