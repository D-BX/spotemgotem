// The classic playlist window: a floating, draggable canvas painted with the
// skin's pledit.txt colors, listing the current playback queue. Clicking a row
// plays that track. Lazy-loaded alongside ClassicPlayer.

import { createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { playerState } from '../player/playerStore';
import { playTrack } from '../player/spotifyPlayer';
import { getQueue } from '../api/spotify';
import type { Track } from '../api/types';
import { activeSkin } from '../skins/skinStore';
import { setPlaylistOpen, type ClassicWindowProps } from './uiState';
import { drawPlaylist, type PlaylistRow } from './draw';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  PLAYLIST_ROW_H,
  PLAYLIST_TITLE_H,
  PLAYLIST_FOOTER_H,
  playlistRowAt,
} from './geometry';

// Native height of the main window + its skin toolbar, used to stack the playlist
// just beneath it when both open centered.
const MAIN_WINDOW_STACK_OFFSET = 150;

interface QueueRows {
  tracks: Track[];
  rows: PlaylistRow[];
}

function toRows(tracks: Track[]): PlaylistRow[] {
  return tracks.map((t) => ({ label: `${t.artists.map((a) => a.name).join(', ')} - ${t.name}` }));
}

const ClassicPlaylist = (props: ClassicWindowProps) => {
  let canvas!: HTMLCanvasElement;
  const [pos, setPos] = createSignal({ x: 24, y: 220 });
  const [scale, setScale] = createSignal(1);
  const [scrollTop, setScrollTop] = createSignal(0);

  onMount(() => {
    // Use a parent-provided placement when tiled; otherwise match the main
    // window's take-over sizing and sit just below it, centered.
    const fit = props.initialScale ?? Math.max(2, Math.min(4, Math.floor(window.innerWidth / 440)));
    setScale(fit);
    setPos({
      x: props.initialX ?? Math.round((window.innerWidth - PLAYLIST_WIDTH * fit) / 2),
      y: props.initialY ?? (Math.round(window.innerHeight * 0.16) + MAIN_WINDOW_STACK_OFFSET * fit),
    });
  });

  // Re-fetch the queue when the current track changes, so the list stays fresh.
  const [queue] = createResource<QueueRows, string>(
    () => playerState.track?.uri ?? 'none',
    async (): Promise<QueueRows> => {
      const res = await getQueue();
      const tracks = res.currently_playing
        ? [res.currently_playing, ...res.queue]
        : res.queue;
      return { tracks, rows: toRows(tracks) };
    },
  );

  function render(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = queue();
    const rows = data?.rows ?? [];
    const currentIndex = playerState.track && data?.tracks[0]?.uri === playerState.track.uri ? 0 : -1;
    drawPlaylist(ctx, activeSkin(), rows, currentIndex, scrollTop());
  }

  createEffect(() => {
    void activeSkin();
    void queue();
    void playerState.track;
    void scrollTop();
    render();
  });

  onMount(() => render());

  // --- Interaction -----------------------------------------------------------

  function toNative(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale(),
      y: (e.clientY - rect.top) / scale(),
    };
  }

  let dragging = false;
  let dragStart = { px: 0, py: 0, wx: 0, wy: 0 };

  function onPointerDown(e: PointerEvent): void {
    const { x, y } = toNative(e);
    canvas.setPointerCapture(e.pointerId);
    // Title bar close glyph (top-right) closes; title bar drags.
    if (y < PLAYLIST_TITLE_H) {
      if (x > PLAYLIST_WIDTH - 12) {
        setPlaylistOpen(false);
        return;
      }
      dragging = true;
      dragStart = { px: e.clientX, py: e.clientY, wx: pos().x, wy: pos().y };
      return;
    }
    // Row click -> play that track.
    const rowIndex = playlistRowAt(y) + Math.floor(scrollTop() / PLAYLIST_ROW_H);
    const data = queue();
    const track = data?.tracks[rowIndex];
    if (track) void playTrack(track.uri);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const dx = e.clientX - dragStart.px;
    const dy = e.clientY - dragStart.py;
    setPos({ x: dragStart.wx + dx, y: dragStart.wy + dy });
  }

  function onPointerUp(e: PointerEvent): void {
    canvas.releasePointerCapture(e.pointerId);
    dragging = false;
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rows = queue()?.rows.length ?? 0;
    const listH = PLAYLIST_HEIGHT - PLAYLIST_TITLE_H - PLAYLIST_FOOTER_H;
    const maxScroll = Math.max(0, rows * PLAYLIST_ROW_H - listH);
    setScrollTop((s) => Math.min(maxScroll, Math.max(0, s + e.deltaY)));
  }

  const wheelHandler = (e: WheelEvent): void => onWheel(e);
  onMount(() => canvas.addEventListener('wheel', wheelHandler, { passive: false }));
  onCleanup(() => canvas.removeEventListener('wheel', wheelHandler));

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        'z-index': '999',
        'touch-action': 'none',
        'user-select': 'none',
        filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
      }}
    >
      <canvas
        ref={canvas}
        width={PLAYLIST_WIDTH}
        height={PLAYLIST_HEIGHT}
        style={{
          width: `${PLAYLIST_WIDTH * scale()}px`,
          height: `${PLAYLIST_HEIGHT * scale()}px`,
          'image-rendering': 'pixelated',
          display: 'block',
          cursor: 'default',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
};

export default ClassicPlaylist;
