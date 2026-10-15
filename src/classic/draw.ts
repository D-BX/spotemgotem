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
  type Rect,
} from '../skins/sprites';
import type { HotspotName } from './geometry';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  PLAYLIST_TITLE_H,
  PLAYLIST_FOOTER_H,
  PLAYLIST_ROW_H,
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

// --- Playlist window --------------------------------------------------------

export interface PlaylistRow {
  label: string;
}

export function drawPlaylist(
  ctx: CanvasRenderingContext2D,
  skin: Skin,
  rows: PlaylistRow[],
  currentIndex: number,
  scrollTop: number,
): void {
  const { normal, current, normalBg, selectedBg, font } = skin.pledit;
  ctx.clearRect(0, 0, PLAYLIST_WIDTH, PLAYLIST_HEIGHT);

  // Background + simple chrome.
  ctx.fillStyle = normalBg;
  ctx.fillRect(0, 0, PLAYLIST_WIDTH, PLAYLIST_HEIGHT);
  ctx.fillStyle = selectedBg;
  ctx.fillRect(0, 0, PLAYLIST_WIDTH, PLAYLIST_TITLE_H);
  ctx.fillStyle = current;
  ctx.font = `bold 11px ${font}, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Playlist', 8, PLAYLIST_TITLE_H / 2);

  // Rows.
  const listTop = PLAYLIST_TITLE_H;
  const listBottom = PLAYLIST_HEIGHT - PLAYLIST_FOOTER_H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop, PLAYLIST_WIDTH, listBottom - listTop);
  ctx.clip();
  ctx.font = `11px ${font}, sans-serif`;
  const first = Math.floor(scrollTop / PLAYLIST_ROW_H);
  const visible = Math.ceil((listBottom - listTop) / PLAYLIST_ROW_H) + 1;
  for (let i = first; i < Math.min(rows.length, first + visible); i++) {
    const rowY = listTop + i * PLAYLIST_ROW_H - scrollTop;
    const isCurrent = i === currentIndex;
    if (isCurrent) {
      ctx.fillStyle = selectedBg;
      ctx.fillRect(0, rowY, PLAYLIST_WIDTH, PLAYLIST_ROW_H);
    }
    ctx.fillStyle = isCurrent ? current : normal;
    const label = `${i + 1}. ${rows[i]!.label}`;
    ctx.fillText(label, 4, rowY + PLAYLIST_ROW_H / 2, PLAYLIST_WIDTH - 8);
  }
  ctx.restore();

  // Footer strip.
  ctx.fillStyle = selectedBg;
  ctx.fillRect(0, listBottom, PLAYLIST_WIDTH, PLAYLIST_FOOTER_H);
  ctx.fillStyle = current;
  ctx.font = `11px ${font}, sans-serif`;
  ctx.fillText(`${rows.length} items`, 8, listBottom + PLAYLIST_FOOTER_H / 2);
}
