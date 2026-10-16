// The classic 275x116 main window: a floating, draggable canvas painted from the
// active skin's sprite sheets and wired to the shared playerState. It only reads
// the store and calls the existing control functions — no new player logic. Lazy-
// loaded (with the whole skin stack + fflate) so it never touches the initial JS.

import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { playerState } from '../player/playerStore';
import {
  activeSkin,
  skinLibrary,
  loadSkinFromFile,
  setActiveSkin,
} from '../skins/skinStore';
import { setClassicOpen, type ClassicWindowProps } from './uiState';
import { getSkinBitmaps, type SheetBitmaps } from '../skins/skinBitmaps';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import { drawMainWindow, type MainDrawState } from './draw';
import { hitTest, type HotspotName } from './geometry';
import { dispatchHotspot } from './controls';

const ClassicPlayer = (props: ClassicWindowProps) => {
  let canvas!: HTMLCanvasElement;
  const [bitmaps, setBitmaps] = createSignal<SheetBitmaps | null>(null);
  const [scale, setScale] = createSignal(1);
  const [pos, setPos] = createSignal({ x: 24, y: 96 });
  const [pressed, setPressed] = createSignal<HotspotName | null>(null);
  const [scrollPx, setScrollPx] = createSignal(0);

  // Upload the active skin's sheets to ImageBitmaps whenever the skin changes.
  createEffect(() => {
    const skin = activeSkin();
    void getSkinBitmaps(skin).then(setBitmaps);
  });

  function render(): void {
    const bmps = bitmaps();
    if (!bmps) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state: MainDrawState = {
      title: playerState.track
        ? `${playerState.track.artists} - ${playerState.track.name}`
        : '',
      positionMs: playerState.positionMs,
      durationMs: playerState.durationMs,
      volume: playerState.volume,
      shuffle: playerState.shuffle,
      repeatMode: playerState.repeatMode,
      paused: playerState.paused,
      stopped: !playerState.track,
      active: true,
      pressed: pressed(),
    };
    drawMainWindow(ctx, bmps, activeSkin(), state, scrollPx());
  }

  // Redraw on any reactive dependency change.
  createEffect(() => {
    // Touch the fields the renderer depends on so Solid tracks them.
    void bitmaps();
    void activeSkin();
    void playerState.track;
    void playerState.positionMs;
    void playerState.volume;
    void playerState.shuffle;
    void playerState.repeatMode;
    void playerState.paused;
    void pressed();
    void scrollPx();
    render();
  });

  // Marquee loop: only runs while a track is playing and the title overflows.
  let raf = 0;
  let last = 0;
  const loop = (t: number): void => {
    if (last === 0) last = t;
    const dt = t - last;
    last = t;
    if (!playerState.paused && playerState.track) {
      setScrollPx((p) => p + dt * 0.03); // ~30px/sec
    }
    raf = requestAnimationFrame(loop);
  };
  onMount(() => {
    // Use the placement handed down by a parent (ClassicApp tiles its windows);
    // otherwise open big and centered so a lone window still fills the view.
    const fit = props.initialScale ?? Math.max(2, Math.min(4, Math.floor(window.innerWidth / 440)));
    setScale(fit);
    setPos({
      x: props.initialX ?? Math.round((window.innerWidth - MAIN_WIDTH * fit) / 2),
      y: props.initialY ?? Math.round(window.innerHeight * 0.16),
    });
    raf = requestAnimationFrame(loop);
  });
  onCleanup(() => cancelAnimationFrame(raf));

  // --- Pointer interaction ---------------------------------------------------

  function toNative(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale(),
      y: (e.clientY - rect.top) / scale(),
    };
  }

  let dragging: 'window' | HotspotName | null = null;
  let dragStart = { px: 0, py: 0, wx: 0, wy: 0 };

  function onPointerDown(e: PointerEvent): void {
    const { x, y } = toNative(e);
    const hot = hitTest(x, y);
    canvas.setPointerCapture(e.pointerId);
    if (hot === 'close') {
      setClassicOpen(false);
      return;
    }
    if (hot === 'shade') {
      setScale((s) => (s >= 4 ? 1 : s + 1)); // repurpose shade as a size cycle
      return;
    }
    if (hot === 'titleBar' || hot === null) {
      dragging = 'window';
      dragStart = { px: e.clientX, py: e.clientY, wx: pos().x, wy: pos().y };
      return;
    }
    dragging = hot;
    setPressed(hot);
    dispatchHotspot(hot, x);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    if (dragging === 'window') {
      const dx = e.clientX - dragStart.px;
      const dy = e.clientY - dragStart.py;
      setPos({ x: dragStart.wx + dx, y: dragStart.wy + dy });
      return;
    }
    if (dragging === 'posBar' || dragging === 'volume') {
      const { x } = toNative(e);
      dispatchHotspot(dragging, x);
    }
  }

  function onPointerUp(e: PointerEvent): void {
    canvas.releasePointerCapture(e.pointerId);
    dragging = null;
    setPressed(null);
  }

  // --- Importing skins (drag & drop, or the file picker in the toolbar) ------

  let fileInput!: HTMLInputElement;

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && /\.wsz$/i.test(file.name)) void loadSkinFromFile(file);
  }

  function onPickFile(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-importing the same filename later
    if (file) void loadSkinFromFile(file);
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        'z-index': '1000',
        'touch-action': 'none',
        'user-select': 'none',
        filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <canvas
        ref={canvas}
        width={MAIN_WIDTH}
        height={MAIN_HEIGHT}
        style={{
          width: `${MAIN_WIDTH * scale()}px`,
          height: `${MAIN_HEIGHT * scale()}px`,
          'image-rendering': 'pixelated',
          cursor: 'default',
          display: 'block',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* Skin toolbar: switch between imported skins or import a new .wsz. */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          'align-items': 'center',
          'margin-top': '0.25rem',
          padding: '0.25rem',
          'font-size': '0.7rem',
          background: 'rgba(0,0,0,0.65)',
          'border-radius': '0.25rem',
          color: '#eee',
          width: `${MAIN_WIDTH * scale()}px`,
          'box-sizing': 'border-box',
        }}
      >
        <select
          value={activeSkin().id}
          onChange={(e) => void setActiveSkin(e.currentTarget.value)}
          style={{ flex: 1, 'font-size': '0.7rem', 'min-width': '0' }}
          title="Choose a skin"
        >
          <For each={skinLibrary()}>
            {(meta) => <option value={meta.id}>{meta.name}</option>}
          </For>
        </select>
        <button
          type="button"
          onClick={() => fileInput.click()}
          style={{ 'font-size': '0.7rem', 'white-space': 'nowrap' }}
        >
          Import .wsz
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".wsz,application/zip"
          onChange={onPickFile}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default ClassicPlayer;
