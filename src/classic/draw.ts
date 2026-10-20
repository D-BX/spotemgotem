// Pure canvas painting for classic mode. These functions only read their inputs
// and draw; all interaction/state lives in the components. Drawing a skin and the
// procedural default go through the same code path, except the song title: a real
// skin blits its bitmap font (text.bmp), while the default sets `proceduralText`
// and we fall back to the canvas system font.

import type { SheetBitmaps } from '../skins/skinBitmaps';
import type { Skin } from '../skins/types';
import {
  PLACE,
  POSBAR,
  VOLUME,
  BALANCE,
  MONOSTER,
  PLAYPAUS,
  SHUFREP,
  MAIN_WIDTH,
  MAIN_HEIGHT,
  POSBAR_THUMB_TRAVEL,
  VOLUME_THUMB_TRAVEL,
  BALANCE_THUMB_TRAVEL,
  TITLEBAR,
  CHAR_W,
  CHAR_H,
  charRect,
  digitRect,
  PLEDIT_SPRITES,
  PLEDIT,
  type Rect,
} from '../skins/sprites';
import type { HotspotName } from './geometry';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  PL_ROW_H,
  PL_TEXT_PAD,
  PL_FONT_PX,
  plInterior,
  plNavRect,
  plListRect,
  plVisibleRows,
  plScrollThumb,
} from './geometry';

export interface MainDrawState {
  title: string;
  positionMs: number;
  durationMs: number;
  volume: number; // 0..1
  shuffle: boolean;
  repeatMode: 0 | 1 | 2;
  paused: boolean;
  stopped: boolean;
  active: boolean; // window focused -> lit title bar
  pressed: HotspotName | null;
}

function blit(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, s: Rect, dx: number, dy: number): void {
  ctx.drawImage(bmp, s.x, s.y, s.w, s.h, dx, dy, s.w, s.h);
}

export function drawMainWindow(
  ctx: CanvasRenderingContext2D,
  bmps: SheetBitmaps,
  skin: Skin,
  state: MainDrawState,
  titleScrollPx: number,
): void {
  ctx.clearRect(0, 0, MAIN_WIDTH, MAIN_HEIGHT);

  // 1. Static chrome.
  ctx.drawImage(bmps.main, 0, 0);

  // 2. Title bar (active vs inactive) over the top strip.
  const bar = state.active ? TITLEBAR.barSelected : TITLEBAR.bar;
  blit(ctx, bmps.titlebar, bar, PLACE.titleBar.x, PLACE.titleBar.y);

  // 3. Position bar thumb.
  const posFrac = state.durationMs > 0 ? state.positionMs / state.durationMs : 0;
  const posThumb = state.pressed === 'posBar' ? POSBAR.thumbSelected : POSBAR.thumb;
  blit(ctx, bmps.posbar, posThumb, PLACE.posBar.x + Math.round(posFrac * POSBAR_THUMB_TRAVEL), PLACE.posBar.y);

  // 4. Volume: pick one of 28 stacked frames, then the thumb.
  const volFrame = Math.min(27, Math.max(0, Math.round(state.volume * 27)));
  blit(ctx, bmps.volume, { x: 0, y: volFrame * 15, w: 68, h: 13 }, PLACE.volume.x, PLACE.volume.y);
  const volThumb = state.pressed === 'volume' ? VOLUME.thumbSelected : VOLUME.thumb;
  blit(ctx, bmps.volume, volThumb, PLACE.volume.x + Math.round(state.volume * VOLUME_THUMB_TRAVEL), PLACE.volume.y + 1);

  // 5. Balance: Spotify has no balance control, so render it centered + static.
  blit(ctx, bmps.balance, { x: 9, y: 0, w: 38, h: 13 }, PLACE.balance.x, PLACE.balance.y);
  const balThumb = BALANCE.thumb;
  blit(ctx, bmps.balance, balThumb, PLACE.balance.x + Math.round(0.5 * BALANCE_THUMB_TRAVEL), PLACE.balance.y + 1);

  // 6. Mono/stereo (always stereo for Spotify).
  blit(ctx, bmps.monoster, MONOSTER.mono, PLACE.mono.x, PLACE.mono.y);
  blit(ctx, bmps.monoster, MONOSTER.stereoSelected, PLACE.stereo.x, PLACE.stereo.y);

  // 7. Shuffle / repeat toggles.
  const shuffleSprite = state.pressed === 'shuffle'
    ? (state.shuffle ? SHUFREP.shuffleSelectedDown : SHUFREP.shuffleDown)
    : (state.shuffle ? SHUFREP.shuffleSelected : SHUFREP.shuffle);
  blit(ctx, bmps.shufrep, shuffleSprite, PLACE.shuffle.x, PLACE.shuffle.y);
  const repeatOn = state.repeatMode > 0;
  const repeatSprite = state.pressed === 'repeat'
    ? (repeatOn ? SHUFREP.repeatSelectedDown : SHUFREP.repeatDown)
    : (repeatOn ? SHUFREP.repeatSelected : SHUFREP.repeat);
  blit(ctx, bmps.shufrep, repeatSprite, PLACE.repeat.x, PLACE.repeat.y);

  // 8. Play/pause/stop indicator.
  const indicator = state.stopped
    ? PLAYPAUS.stopped
    : state.paused
      ? PLAYPAUS.paused
      : PLAYPAUS.playing;
  blit(ctx, bmps.playpaus, indicator, PLACE.playIndicator.x, PLACE.playIndicator.y);

  // 9. Time digits (elapsed mm:ss).
  drawTime(ctx, bmps, state.positionMs);

  // 10. Song title.
  drawTitle(ctx, bmps, skin, state.title, titleScrollPx);
}

// ===========================================================================
// Playlist window (pledit.bmp)
// ===========================================================================
// The browser panel is the authentic Winamp playlist-editor window: its frame,
// edges, corners, and scrollbar thumb are blitted from the skin's pledit.bmp,
// and the list text is drawn in the skin's pledit font/colours. A thin tab row
// (Queue / Playlists / Liked / Skins) and a couple of text actions live inside
// the interior so the one window covers everything the old CSS panel did.

export interface PlRowVM {
  text: string;
  current: boolean; // the currently-playing track (highlighted)
}

export interface PlaylistViewModel {
  active: boolean; // focused -> selected (brighter) frame artwork
  title: string; // centered window title
  tabs: { label: string; active: boolean }[];
  actions: { label: string }[]; // right-aligned text buttons in the nav row
  rows: PlRowVM[];
  firstRow: number; // scroll offset, in whole rows
  notice: string | null; // shown centered instead of rows (loading/empty/error)
}

/** Rects (native px) of the text controls draw painted, so the component can
 *  hit-test clicks against exactly what's on screen. */
export interface PlaylistHitRegions {
  tabs: Rect[]; // parallel to vm.tabs
  actions: Rect[]; // parallel to vm.actions
}

function pleditFont(skin: Skin, px = PL_FONT_PX, bold = false): string {
  const weight = bold ? 'bold ' : '';
  return `${weight}${px}px ${skin.pledit.font}, "MS Sans Serif", Tahoma, sans-serif`;
}

/** Truncate with an ellipsis so text never spills past `maxW`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/** Blit `s` horizontally from x0 up to (not past) x1, clipping the final tile. */
function tileRow(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, s: Rect, x0: number, x1: number, dy: number): void {
  for (let x = x0; x < x1; x += s.w) {
    const w = Math.min(s.w, x1 - x);
    ctx.drawImage(bmp, s.x, s.y, w, s.h, x, dy, w, s.h);
  }
}

/** Blit `s` vertically from y0 up to (not past) y1, clipping the final tile. */
function tileCol(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, s: Rect, dx: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y += s.h) {
    const h = Math.min(s.h, y1 - y);
    ctx.drawImage(bmp, s.x, s.y, s.w, h, dx, y, s.w, h);
  }
}

export function drawPlaylistWindow(
  ctx: CanvasRenderingContext2D,
  bmps: SheetBitmaps,
  skin: Skin,
  vm: PlaylistViewModel,
  w: number = PLAYLIST_WIDTH,
  h: number = PLAYLIST_HEIGHT,
): PlaylistHitRegions {
  const pal = skin.pledit;
  const sel = vm.active;
  const sp = PLEDIT_SPRITES;
  const interior = plInterior(w, h);

  ctx.clearRect(0, 0, w, h);

  // Interior background colour (behind the list + nav).
  ctx.fillStyle = pal.normalBg;
  ctx.fillRect(interior.x, interior.y, interior.w, interior.h);

  // --- Title row: corners + repeating top tile + centered title ------------
  const titleY = 0;
  tileRow(ctx, bmps.pledit, sel ? sp.topTileSelected : sp.topTile, PLEDIT.TOP_TILE_W, w - PLEDIT.TOP_TILE_W, titleY);
  blit(ctx, bmps.pledit, sel ? sp.topLeftSelected : sp.topLeft, 0, titleY);
  blit(ctx, bmps.pledit, sel ? sp.topRightSelected : sp.topRight, w - PLEDIT.TOP_TILE_W, titleY);
  const titleX = Math.round((w - PLEDIT.TITLE_BAR_W) / 2);
  blit(ctx, bmps.pledit, sel ? sp.titleBarSelected : sp.titleBar, titleX, titleY);

  // --- Side edges ----------------------------------------------------------
  tileCol(ctx, bmps.pledit, sp.leftTile, 0, PLEDIT.TITLE_H, h - PLEDIT.BOTTOM_H);
  tileCol(ctx, bmps.pledit, sp.rightTile, w - PLEDIT.RIGHT_W, PLEDIT.TITLE_H, h - PLEDIT.BOTTOM_H);

  // --- Bottom row: two corners span the 275px width exactly ----------------
  const bottomY = h - PLEDIT.BOTTOM_H;
  blit(ctx, bmps.pledit, sp.bottomLeft, 0, bottomY);
  blit(ctx, bmps.pledit, sp.bottomRight, w - sp.bottomRight.w, bottomY);

  // --- Window title text, centered over the title bar art ------------------
  if (vm.title) {
    ctx.font = pleditFont(skin, PL_FONT_PX, true);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.current;
    const t = fitText(ctx, vm.title.toUpperCase(), PLEDIT.TITLE_BAR_W - 10);
    ctx.fillText(t, w / 2, PLEDIT.TITLE_H / 2 + 1);
    ctx.textAlign = 'left';
  }

  // --- Nav row: tabs on the left, actions on the right ---------------------
  const nav = plNavRect(w, h);
  const regions: PlaylistHitRegions = { tabs: [], actions: [] };
  ctx.font = pleditFont(skin, PL_FONT_PX, true);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const navMidY = nav.y + nav.h / 2 + 1;
  const tabPadX = 5;

  let tx = nav.x + PL_TEXT_PAD;
  vm.tabs.forEach((tab) => {
    const tw = ctx.measureText(tab.label).width;
    const slot: Rect = { x: tx, y: nav.y, w: tw + tabPadX * 2, h: nav.h };
    if (tab.active) {
      ctx.fillStyle = pal.selectedBg;
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }
    ctx.fillStyle = tab.active ? pal.current : pal.normal;
    ctx.fillText(tab.label, slot.x + tabPadX, navMidY);
    regions.tabs.push(slot);
    tx += slot.w;
  });

  // Actions laid out from the right edge inward.
  let ax = nav.x + nav.w - PL_TEXT_PAD;
  vm.actions.forEach((action) => {
    const aw = ctx.measureText(action.label).width + tabPadX * 2;
    const slot: Rect = { x: ax - aw, y: nav.y, w: aw, h: nav.h };
    ctx.fillStyle = pal.normal;
    ctx.fillText(action.label, slot.x + tabPadX, navMidY);
    regions.actions.push(slot);
    ax -= aw;
  });

  // Thin separator under the nav row.
  ctx.fillStyle = pal.selectedBg;
  ctx.fillRect(nav.x, nav.y + nav.h - 1, nav.w, 1);

  // --- List area -----------------------------------------------------------
  const list = plListRect(w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(list.x, list.y, list.w, list.h);
  ctx.clip();

  if (vm.notice) {
    ctx.font = pleditFont(skin, PL_FONT_PX);
    ctx.fillStyle = pal.normal;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vm.notice, list.x + list.w / 2, list.y + list.h / 2);
    ctx.textAlign = 'left';
  } else {
    ctx.font = pleditFont(skin, PL_FONT_PX);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const visible = plVisibleRows(w, h);
    const textMaxW = list.w - PL_TEXT_PAD * 2;
    for (let i = 0; i < visible; i++) {
      const idx = vm.firstRow + i;
      const row = vm.rows[idx];
      if (!row) break;
      const ry = list.y + i * PL_ROW_H;
      if (row.current) {
        ctx.fillStyle = pal.selectedBg;
        ctx.fillRect(list.x, ry, list.w, PL_ROW_H);
      }
      ctx.fillStyle = row.current ? pal.current : pal.normal;
      ctx.fillText(fitText(ctx, row.text, textMaxW), list.x + PL_TEXT_PAD, ry + PL_ROW_H / 2 + 1);
    }
  }
  ctx.restore();

  // --- Scrollbar thumb (only when the list overflows) ----------------------
  const total = vm.rows.length;
  const maxScroll = Math.max(0, total - plVisibleRows(w, h));
  if (maxScroll > 0 && !vm.notice) {
    const thumb = plScrollThumb(vm.firstRow, maxScroll, w, h);
    blit(ctx, bmps.pledit, sel ? sp.scrollHandleSelected : sp.scrollHandle, thumb.x, thumb.y);
  }

  return regions;
}

function drawTime(ctx: CanvasRenderingContext2D, bmps: SheetBitmaps, positionMs: number): void {
  const totalSec = Math.max(0, Math.floor(positionMs / 1000));
  const mm = Math.min(99, Math.floor(totalSec / 60));
  const ss = totalSec % 60;
  const digits = [Math.floor(mm / 10), mm % 10, Math.floor(ss / 10), ss % 10];
  PLACE.timeDigits.forEach((slot, i) => {
    blit(ctx, bmps.numbers, digitRect(digits[i]!), slot.x, slot.y);
  });
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  bmps: SheetBitmaps,
  skin: Skin,
  title: string,
  scrollPx: number,
): void {
  const { x, y, w } = PLACE.title;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, CHAR_H + 2);
  ctx.clip();

  if (skin.proceduralText) {
    // Default skin: readable system font instead of a bitmap glyph sheet.
    ctx.fillStyle = `rgb(${skin.pledit.current ? '0,230,120' : '0,230,120'})`;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    const text = title || 'spotemgotem';
    const textW = ctx.measureText(text + '    ').width;
    const off = textW > w ? scrollPx % textW : 0;
    ctx.fillText(text + '    ' + text, x - off, y);
  } else {
    // Bitmap font: blit each glyph from text.bmp.
    const text = (title || 'SPOTEMGOTEM').toUpperCase();
    const advance = CHAR_W;
    const fullW = text.length * advance;
    const gap = 15; // spaces between marquee repeats
    const loopW = fullW + gap * advance;
    const off = fullW > w ? scrollPx % loopW : 0;
    let dx = x - off;
    // Draw two copies so the marquee wraps seamlessly.
    for (let copy = 0; copy < 2; copy++) {
      for (let i = 0; i < text.length; i++) {
        const gx = dx + i * advance;
        if (gx + advance >= x && gx <= x + w) {
          blit(ctx, bmps.text, charRect(text[i]!), gx, y);
        }
      }
      dx += loopW;
    }
  }
  ctx.restore();
}
