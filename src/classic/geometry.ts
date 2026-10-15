// Click hotspots on the 275x116 main window face. Coordinates are in native skin
// pixels (before any 2x scaling); ClassicPlayer maps a canvas click back to native
// pixels and tests it against these rects to decide which control was hit.

import type { Rect } from '../skins/sprites';
import { PLACE, CBUTTONS, POSBAR, MAIN_WIDTH } from '../skins/sprites';

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const HOTSPOTS = {
  // Transport row (button sizes come from the cbuttons sprite dimensions).
  prev: rect(PLACE.prev.x, PLACE.prev.y, CBUTTONS.prev.w, CBUTTONS.prev.h),
  play: rect(PLACE.play.x, PLACE.play.y, CBUTTONS.play.w, CBUTTONS.play.h),
  pause: rect(PLACE.pause.x, PLACE.pause.y, CBUTTONS.pause.w, CBUTTONS.pause.h),
  stop: rect(PLACE.stop.x, PLACE.stop.y, CBUTTONS.stop.w, CBUTTONS.stop.h),
  next: rect(PLACE.next.x, PLACE.next.y, CBUTTONS.next.w, CBUTTONS.next.h),
  eject: rect(PLACE.eject.x, PLACE.eject.y, CBUTTONS.eject.w, CBUTTONS.eject.h),

  // Sliders — the whole track is draggable/clickable.
  posBar: rect(PLACE.posBar.x, PLACE.posBar.y, POSBAR.background.w, POSBAR.background.h),
  volume: rect(PLACE.volume.x, PLACE.volume.y, 68, 13),
  balance: rect(PLACE.balance.x, PLACE.balance.y, 38, 13),

  // Toggles.
  shuffle: rect(PLACE.shuffle.x, PLACE.shuffle.y, 47, 15),
  repeat: rect(PLACE.repeat.x, PLACE.repeat.y, 28, 15),

  // Title-bar window controls (classic positions on the 275px face).
  titleBar: rect(0, 0, MAIN_WIDTH, 14),
  close: rect(264, 3, 9, 9),
  shade: rect(254, 3, 9, 9),
} as const;

export type HotspotName = keyof typeof HOTSPOTS;

export function hitTest(x: number, y: number): HotspotName | null {
  // Check the small window controls before the broad titleBar drag region.
  const order: HotspotName[] = [
    'close', 'shade',
    'prev', 'play', 'pause', 'stop', 'next', 'eject',
    'shuffle', 'repeat', 'posBar', 'volume', 'balance',
    'titleBar',
  ];
  for (const name of order) {
    const r = HOTSPOTS[name];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return name;
  }
  return null;
}

/** Fraction 0..1 for a click at native x within a horizontal track [x, x+travel]. */
export function trackFraction(nativeX: number, trackX: number, travel: number): number {
  const f = (nativeX - trackX) / travel;
  return Math.min(1, Math.max(0, f));
}

// --- Playlist window metrics ------------------------------------------------
// The classic playlist is resizable in real Winamp; we render a fixed, readable
// size here. Row text uses pledit colors (see draw.ts drawPlaylist).

export const PLAYLIST_WIDTH = 275;
export const PLAYLIST_HEIGHT = 232;
export const PLAYLIST_TITLE_H = 20;
export const PLAYLIST_FOOTER_H = 38;
export const PLAYLIST_ROW_H = 13;

/** Index of the playlist row under a client y (native px), or -1 outside rows. */
export function playlistRowAt(nativeY: number): number {
  const top = PLAYLIST_TITLE_H;
  const bottom = PLAYLIST_HEIGHT - PLAYLIST_FOOTER_H;
  if (nativeY < top || nativeY >= bottom) return -1;
  return Math.floor((nativeY - top) / PLAYLIST_ROW_H);
}

export const PLAYLIST_VISIBLE_ROWS = Math.floor(
  (PLAYLIST_HEIGHT - PLAYLIST_TITLE_H - PLAYLIST_FOOTER_H) / PLAYLIST_ROW_H,
);
