// Click hotspots on the 275x116 main window face. Coordinates are in native skin
// pixels (before any 2x scaling); ClassicPlayer maps a canvas click back to native
// pixels and tests it against these rects to decide which control was hit.

import type { Rect } from '../skins/sprites';
import { PLACE, CBUTTONS, POSBAR, MAIN_WIDTH, PLEDIT } from '../skins/sprites';

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

// --- Classic window body metrics --------------------------------------------
// The browser panel below the player (ClassicList) is sized in native skin pixels
// (× the shared scale) so it lines up flush with the player face. Width tracks the
// 275px player; this fixed height sets the panel's scaled height.

export const PLAYLIST_WIDTH = MAIN_WIDTH;
export const PLAYLIST_HEIGHT = 232;

// --- Playlist-window interior layout (native px) ----------------------------
// The pledit frame reserves a 20px title row, 12/20px side edges, and a 38px
// bottom row. Inside that we stack a thin tab/nav row over the scrolling list.
// draw.ts and the component both derive their geometry from these so clicks land
// on what's painted.

export const PL_NAV_H = 14; // tab/action row height
export const PL_ROW_H = 11; // one track row
export const PL_TEXT_PAD = 4; // left/right inset for list + nav text
export const PL_FONT_PX = 8; // row/nav font size (native px)

/** The drawable interior (between the frame edges). */
export function plInterior(w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): Rect {
  return {
    x: PLEDIT.LEFT_W,
    y: PLEDIT.TITLE_H,
    w: w - PLEDIT.LEFT_W - PLEDIT.RIGHT_W,
    h: h - PLEDIT.TITLE_H - PLEDIT.BOTTOM_H,
  };
}

/** The tab/action row at the top of the interior. */
export function plNavRect(w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): Rect {
  const i = plInterior(w, h);
  return { x: i.x, y: i.y, w: i.w, h: PL_NAV_H };
}

/** The scrolling track-list area (interior minus the nav row). */
export function plListRect(w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): Rect {
  const i = plInterior(w, h);
  return { x: i.x, y: i.y + PL_NAV_H, w: i.w, h: i.h - PL_NAV_H };
}

/** How many whole rows fit in the list area. */
export function plVisibleRows(w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): number {
  return Math.max(1, Math.floor(plListRect(w, h).h / PL_ROW_H));
}

/** Vertical scrollbar track (inside the right edge, alongside the list). */
export function plScrollTrack(w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): Rect {
  const list = plListRect(w, h);
  return { x: w - PLEDIT.RIGHT_W + 6, y: list.y, w: PLEDIT.SCROLL_W, h: list.h };
}

/** The scroll thumb rect for a given scroll position. */
export function plScrollThumb(
  firstRow: number,
  maxScroll: number,
  w = PLAYLIST_WIDTH,
  h = PLAYLIST_HEIGHT,
): Rect {
  const track = plScrollTrack(w, h);
  const travel = Math.max(0, track.h - PLEDIT.SCROLL_H);
  const frac = maxScroll > 0 ? Math.min(1, Math.max(0, firstRow / maxScroll)) : 0;
  return { x: track.x, y: track.y + Math.round(frac * travel), w: PLEDIT.SCROLL_W, h: PLEDIT.SCROLL_H };
}

/** Which row index (absolute, accounting for scroll) is at native y, or -1. */
export function plRowAt(y: number, firstRow: number, w = PLAYLIST_WIDTH, h = PLAYLIST_HEIGHT): number {
  const list = plListRect(w, h);
  if (y < list.y || y >= list.y + list.h) return -1;
  return firstRow + Math.floor((y - list.y) / PL_ROW_H);
}

export function pointIn(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
