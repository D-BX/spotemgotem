// parseSkin() turns the raw bytes of a .wsz file (a renamed .zip of BMP sprite
// sheets + a few text files) into a typed `Skin`. Winamp skins are wildly
// inconsistent about filename casing and which optional files they include, so we:
//   - match every entry by lowercased basename (MAIN.BMP, main.bmp, skins/main.bmp
//     all resolve to "main"),
//   - accept numbers.bmp OR nums_ex.bmp for the `numbers` sheet,
//   - decode each sheet with our pure BMP decoder, and
//   - substitute the procedural default for any sheet that is missing or fails to
//     decode, so a half-broken skin still renders.

import { unzipSync } from 'fflate';
import { decodeBmp, type DecodedImage } from './bmp';
import { createDefaultSkin } from './defaultSkin';
import { parsePledit, parseViscolor, DEFAULT_PLEDIT, type Rgb } from './parseText';
import {
  SHEET_FILES,
  SHEET_NAMES,
  type SheetName,
  type Skin,
} from './types';

/** Strip any directory prefix and lowercase, e.g. "Skins/MAIN.BMP" -> "main.bmp". */
function basename(path: string): string {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return path.slice(slash + 1).toLowerCase();
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `skin-${Date.now().toString(36)}-${idCounter}`;
}

const textDecoder = new TextDecoder('latin1');

export interface ParseSkinOptions {
  /** Human-readable name; defaults to the file name without extension. */
  name?: string;
  /** Stable id (e.g. when reloading from storage); defaults to a fresh one. */
  id?: string;
}

/**
 * Parse `.wsz` bytes into a `Skin`. Never throws for a merely incomplete skin —
 * missing/un-decodable sheets fall back to the procedural default. Throws only if
 * the input is not a valid zip at all.
 */
export function parseSkin(buf: ArrayBuffer | Uint8Array, options: ParseSkinOptions = {}): Skin {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const entries = unzipSync(bytes);

  // Map lowercased basename -> file bytes (last one wins, matching Winamp).
  const files = new Map<string, Uint8Array>();
  for (const path of Object.keys(entries)) {
    if (path.endsWith('/')) continue; // directory entry
    files.set(basename(path), entries[path]!);
  }

  const fallback = createDefaultSkin();
  const sheets = {} as Record<SheetName, DecodedImage>;

  for (const name of SHEET_NAMES) {
    sheets[name] = decodeSheet(name, files) ?? fallback.sheets[name];
  }

  const viscolor = readViscolor(files);
  const pledit = readPledit(files);

  return {
    id: options.id ?? nextId(),
    name: options.name ?? 'Imported skin',
    sheets,
    viscolor,
    pledit,
    // Imported skins ship a real text.bmp glyph font, so draw via the bitmap font.
    proceduralText: false,
  };
}

/** Decode the first candidate .bmp that exists for a sheet; null if none/failed. */
function decodeSheet(name: SheetName, files: Map<string, Uint8Array>): DecodedImage | null {
  for (const candidate of SHEET_FILES[name]) {
    const data = files.get(candidate);
    if (!data) continue;
    try {
      return decodeBmp(data);
    } catch {
      // Corrupt sheet: fall through to the next candidate, then to the default.
    }
  }
  return null;
}

function readViscolor(files: Map<string, Uint8Array>): Rgb[] {
  const data = files.get('viscolor.txt');
  if (!data) return createDefaultSkin().viscolor;
  return parseViscolor(textDecoder.decode(data));
}

function readPledit(files: Map<string, Uint8Array>) {
  const data = files.get('pledit.txt');
  if (!data) return DEFAULT_PLEDIT;
  return parsePledit(textDecoder.decode(data));
}
