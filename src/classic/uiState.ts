// Lightweight open-state signals for classic mode. Kept free of any heavy imports
// (no skin parser, no fflate) so the app shell can toggle the windows and lazy-load
// the real UI only when they first open — keeping the initial bundle small.

import { createSignal } from 'solid-js';

export const [classicOpen, setClassicOpen] = createSignal(false);
export const [playlistOpen, setPlaylistOpen] = createSignal(false);
export const [libraryOpen, setLibraryOpen] = createSignal(false);

/** Optional initial placement a parent (e.g. ClassicApp) can hand to a window so
 * it can tile several windows without them stacking on top of each other. When a
 * field is omitted the window falls back to its own centered default. */
export interface ClassicWindowProps {
  initialX?: number;
  initialY?: number;
  initialScale?: number;
}
