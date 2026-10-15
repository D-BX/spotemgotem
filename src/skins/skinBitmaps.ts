// Browser-only bridge from decoded sheets (raw RGBA) to ImageBitmaps for fast
// canvas blitting. Kept separate from the DOM-free parser so the parser stays
// Node-testable. Results are memoized per Skin via a WeakMap, so switching skins
// back and forth doesn't re-upload the same pixels.

import type { DecodedImage } from './bmp';
import type { SheetName, Skin } from './types';

export type SheetBitmaps = Record<SheetName, ImageBitmap>;

const cache = new WeakMap<Skin, SheetBitmaps>();

function toImageData(img: DecodedImage): ImageData {
  // ImageData wants an ArrayBuffer-backed Uint8ClampedArray of width*height*4;
  // copy into a fresh one so the type is a plain ArrayBuffer (not ArrayBufferLike).
  const data = new Uint8ClampedArray(img.data);
  return new ImageData(data, img.width, img.height);
}

/** Decode every sheet of a skin to an ImageBitmap, memoized per skin object. */
export async function getSkinBitmaps(skin: Skin): Promise<SheetBitmaps> {
  const existing = cache.get(skin);
  if (existing) return existing;

  const names = Object.keys(skin.sheets) as SheetName[];
  const bitmaps = await Promise.all(
    names.map((name) => createImageBitmap(toImageData(skin.sheets[name]))),
  );

  const result = {} as SheetBitmaps;
  names.forEach((name, i) => {
    result[name] = bitmaps[i]!;
  });
  cache.set(skin, result);
  return result;
}
