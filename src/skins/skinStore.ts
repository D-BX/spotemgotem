// Reactive state + persistence for classic mode. Three kinds of skins live here:
//   - the procedural default (id 'default'), always present, no storage;
//   - bundled skins shipped with the app (id 'builtin:<file>'), emitted by Vite as
//     hashed assets and fetched + parsed on demand (never in the initial JS);
//   - user imports (id 'skin-...'), whose raw .wsz bytes are kept in IndexedDB so
//     they survive reloads. Only a lightweight {id,name} index drives the library.

import { createSignal } from 'solid-js';
import { createStore, get, set, del } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';
import { parseSkin } from './skinParser';
import { createDefaultSkin } from './defaultSkin';
import type { Skin } from './types';

// The open-state signals live in a lightweight module so the app shell can toggle
// classic mode without importing this (fflate-bearing) store.
export {
  classicOpen,
  setClassicOpen,
  playlistOpen,
  setPlaylistOpen,
} from '../classic/uiState';

const store: UseStore = createStore('spotemgotem-skins', 'wsz');

const KEY_ACTIVE = 'skin:active'; // string id of the active skin
const KEY_INDEX = 'skin:libindex'; // SkinMeta[] (user imports only)
const keyBytes = (id: string): string => `skin:lib:${id}`;

export interface SkinMeta {
  id: string;
  name: string;
}

const DEFAULT_META: SkinMeta = { id: 'default', name: 'Default (built-in)' };

// --- Bundled skins ----------------------------------------------------------
// Vite emits each .wsz under fixtures/skins as a separate hashed asset and gives
// us its URL (a plain string here). We only fetch + parse one when it's selected.
const BUILTIN_PREFIX = 'builtin:';
const bundledUrls = import.meta.glob('../../fixtures/skins/*.wsz', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function prettify(file: string): string {
  return file.replace(/\.wsz$/i, '').replace(/[_]+/g, ' ').trim();
}

/** builtin id -> asset URL, and the ordered meta list for the library. */
const builtinUrlById = new Map<string, string>();
const BUILTIN_METAS: SkinMeta[] = Object.entries(bundledUrls)
  .map(([path, url]) => {
    const file = path.split('/').pop() ?? path;
    const id = `${BUILTIN_PREFIX}${file.replace(/\.wsz$/i, '')}`;
    builtinUrlById.set(id, url);
    return { id, name: prettify(file) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Parsed builtin skins are cached so re-selecting one is instant and reuses its
// uploaded ImageBitmaps (skinBitmaps memoizes per Skin object).
const builtinCache = new Map<string, Skin>();

async function loadBuiltin(id: string): Promise<Skin | null> {
  const cached = builtinCache.get(id);
  if (cached) return cached;
  const url = builtinUrlById.get(id);
  if (!url) return null;
  const meta = BUILTIN_METAS.find((m) => m.id === id);
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  const skin = parseSkin(buf, { id, name: meta?.name });
  builtinCache.set(id, skin);
  return skin;
}

// --- Reactive signals -------------------------------------------------------

const [activeSkin, setActiveSkinSignal] = createSignal<Skin>(createDefaultSkin());
const [skinLibrary, setSkinLibrary] = createSignal<SkinMeta[]>([
  DEFAULT_META,
  ...BUILTIN_METAS,
]);

export { activeSkin, skinLibrary };

// --- Persistence helpers ----------------------------------------------------

async function readIndex(): Promise<SkinMeta[]> {
  const index = await get<SkinMeta[]>(KEY_INDEX, store);
  const imports = (index ?? []).filter(
    (m) => m.id !== 'default' && !m.id.startsWith(BUILTIN_PREFIX),
  );
  return [DEFAULT_META, ...BUILTIN_METAS, ...imports];
}

function writeIndex(metas: SkinMeta[]): Promise<void> {
  // Persist user imports only; default + bundled are always rebuilt in code.
  const persistable = metas.filter(
    (m) => m.id !== 'default' && !m.id.startsWith(BUILTIN_PREFIX),
  );
  return set(KEY_INDEX, persistable, store);
}

// --- Public actions ---------------------------------------------------------

/** Import a .wsz File: parse, persist its bytes, add to library, make it active. */
export async function loadSkinFromFile(file: File): Promise<Skin> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name.replace(/\.wsz$/i, '');
  const skin = parseSkin(buf, { name });

  await set(keyBytes(skin.id), buf, store);
  const meta: SkinMeta = { id: skin.id, name: skin.name };
  const library = [...skinLibrary().filter((m) => m.id !== skin.id), meta];
  setSkinLibrary(library);
  await writeIndex(library);

  setActiveSkinSignal(skin);
  await set(KEY_ACTIVE, skin.id, store);
  return skin;
}

/** Switch the active skin by id ('default', a 'builtin:' skin, or a stored import). */
export async function setActiveSkin(id: string): Promise<void> {
  if (id === 'default') {
    setActiveSkinSignal(createDefaultSkin());
    await set(KEY_ACTIVE, 'default', store);
    return;
  }
  if (id.startsWith(BUILTIN_PREFIX)) {
    const skin = await loadBuiltin(id);
    if (!skin) return;
    setActiveSkinSignal(skin);
    await set(KEY_ACTIVE, id, store);
    return;
  }
  const bytes = await get<Uint8Array>(keyBytes(id), store);
  if (!bytes) return; // stale id; ignore
  const meta = skinLibrary().find((m) => m.id === id);
  const skin = parseSkin(bytes, { id, name: meta?.name });
  setActiveSkinSignal(skin);
  await set(KEY_ACTIVE, id, store);
}

/** Delete an imported skin; falls back to default if it was active. */
export async function removeSkin(id: string): Promise<void> {
  if (id === 'default' || id.startsWith(BUILTIN_PREFIX)) return;
  await del(keyBytes(id), store);
  const library = skinLibrary().filter((m) => m.id !== id);
  setSkinLibrary(library);
  await writeIndex(library);
  if (activeSkin().id === id) await setActiveSkin('default');
}

/** Restore library + last active skin from IndexedDB. Non-blocking at call site. */
export async function initSkins(): Promise<void> {
  const library = await readIndex();
  setSkinLibrary(library);
  const activeId = (await get<string>(KEY_ACTIVE, store)) ?? 'default';
  try {
    await setActiveSkin(activeId);
  } catch {
    await setActiveSkin('default'); // e.g. a bundled fetch failed offline
  }
}
