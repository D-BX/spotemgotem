import { describe, it, expect } from 'vitest';
import { PLEDIT, PLEDIT_SPRITES, MAIN_WIDTH } from '../skins/sprites';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  PL_ROW_H,
  plInterior,
  plNavRect,
  plListRect,
  plVisibleRows,
  plScrollTrack,
  plScrollThumb,
  plRowAt,
  pointIn,
} from './geometry';

describe('pledit window layout', () => {
  it('matches the player face width', () => {
    expect(PLAYLIST_WIDTH).toBe(MAIN_WIDTH);
  });

  it('bottom corners span the full width with no gap', () => {
    expect(PLEDIT_SPRITES.bottomLeft.w + PLEDIT_SPRITES.bottomRight.w).toBe(PLAYLIST_WIDTH);
  });

  it('interior sits inside the frame edges', () => {
    const i = plInterior();
    expect(i.x).toBe(PLEDIT.LEFT_W);
    expect(i.y).toBe(PLEDIT.TITLE_H);
    expect(i.x + i.w).toBe(PLAYLIST_WIDTH - PLEDIT.RIGHT_W);
    expect(i.y + i.h).toBe(PLAYLIST_HEIGHT - PLEDIT.BOTTOM_H);
    expect(i.w).toBeGreaterThan(0);
    expect(i.h).toBeGreaterThan(0);
  });

  it('nav row sits above the list, both within the interior', () => {
    const i = plInterior();
    const nav = plNavRect();
    const list = plListRect();
    expect(nav.y).toBe(i.y);
    expect(list.y).toBe(nav.y + nav.h);
    expect(list.y + list.h).toBe(i.y + i.h);
    expect(plVisibleRows()).toBeGreaterThanOrEqual(1);
  });

  it('scrollbar track and thumb stay inside the right edge', () => {
    const track = plScrollTrack();
    expect(track.x).toBeGreaterThanOrEqual(PLAYLIST_WIDTH - PLEDIT.RIGHT_W);
    expect(track.x + track.w).toBeLessThanOrEqual(PLAYLIST_WIDTH);
    const top = plScrollThumb(0, 10);
    const bottom = plScrollThumb(10, 10);
    expect(top.y).toBe(track.y); // first row -> top of track
    expect(bottom.y + bottom.h).toBeLessThanOrEqual(track.y + track.h); // last row -> bottom
    expect(bottom.y).toBeGreaterThan(top.y);
  });

  it('maps a y inside the list to the right absolute row index', () => {
    const list = plListRect();
    // First visible row at scroll offset 0.
    expect(plRowAt(list.y + 1, 0)).toBe(0);
    // Second visible row.
    expect(plRowAt(list.y + PL_ROW_H + 1, 0)).toBe(1);
    // Scroll offset is added.
    expect(plRowAt(list.y + 1, 5)).toBe(5);
    // Clicks above the list (in the nav row) are not rows.
    expect(plRowAt(list.y - 1, 0)).toBe(-1);
  });

  it('pointIn is a half-open rect test', () => {
    const r = { x: 10, y: 10, w: 5, h: 5 };
    expect(pointIn(r, 10, 10)).toBe(true);
    expect(pointIn(r, 14, 14)).toBe(true);
    expect(pointIn(r, 15, 15)).toBe(false);
    expect(pointIn(r, 9, 10)).toBe(false);
  });
});
