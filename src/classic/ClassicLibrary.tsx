// The classic "media library" window: a floating, draggable canvas painted with
// the skin's pledit colors, listing the user's playlists. Clicking a row starts
// that playlist's context on the Spotify player. This is what makes classic mode
// navigable on its own — you can traverse playlists without the modern sidebar.
// Lazy-loaded alongside the other classic windows.

import { createEffect, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { playContext } from '../player/spotifyPlayer';
import { getMyPlaylists } from '../api/spotify';
import type { PlaylistSummary } from '../api/types';
import { activeSkin } from '../skins/skinStore';
import { setLibraryOpen, type ClassicWindowProps } from './uiState';
import { drawLibrary, type PlaylistRow } from './draw';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  PLAYLIST_ROW_H,
  PLAYLIST_TITLE_H,
  PLAYLIST_FOOTER_H,
  playlistRowAt,
} from './geometry';

// Stack this window to the right of the main/playlist stack when opened centered
// without a parent-provided placement.
const LIBRARY_STACK_OFFSET_X = 300;

interface LibraryRows {
  playlists: PlaylistSummary[];
  rows: PlaylistRow[];
}

function toRows(playlists: PlaylistSummary[]): PlaylistRow[] {
  return playlists.map((p) => ({
    label: `${p.name}  (${p.tracks.total})`,
  }));
}

const ClassicLibrary = (props: ClassicWindowProps) => {
  let canvas!: HTMLCanvasElement;
  const [pos, setPos] = createSignal({ x: 320, y: 220 });
  const [scale, setScale] = createSignal(1);
  const [scrollTop, setScrollTop] = createSignal(0);

  onMount(() => {
    const fit = props.initialScale ?? Math.max(2, Math.min(4, Math.floor(window.innerWidth / 440)));
    setScale(fit);
    setPos({
      x: props.initialX ?? (Math.round((window.innerWidth - PLAYLIST_WIDTH * fit) / 2) + LIBRARY_STACK_OFFSET_X),
      y: props.initialY ?? Math.round(window.innerHeight * 0.16),
    });
  });

  const [library] = createResource<LibraryRows>(async (): Promise<LibraryRows> => {
    const playlists = await getMyPlaylists();
    return { playlists, rows: toRows(playlists) };
  });

  function render(): void {
    const c = canvas.getContext('2d');
    if (!c) return;
    const data = library();
    const rows = data?.rows ?? [];
    // No reliable "active playlist" signal from the player store, so no row is
    // marked current; clicking a row starts that playlist's context.
    drawLibrary(c, activeSkin(), rows, -1, scrollTop());
  }

  createEffect(() => {
    void activeSkin();
    void library();
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
        setLibraryOpen(false);
        return;
      }
      dragging = true;
      dragStart = { px: e.clientX, py: e.clientY, wx: pos().x, wy: pos().y };
      return;
    }
    // Row click -> play that playlist's context.
    const rowIndex = playlistRowAt(y) + Math.floor(scrollTop() / PLAYLIST_ROW_H);
    const data = library();
    const playlist = data?.playlists[rowIndex];
    if (playlist) void playContext(playlist.uri);
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
    const rows = library()?.rows.length ?? 0;
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

export default ClassicLibrary;
