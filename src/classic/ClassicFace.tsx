// The skin's 275x116 main window as an embeddable canvas. It owns only drawing and
// pointer interaction for the player face — no floating wrapper, no toolbar, no skin
// picker. Both the unified classic shell (ClassicApp) and the Document
// Picture-in-Picture window (ClassicPipPlayer) render this, so the player looks and
// behaves identically everywhere. It reads the shared playerState and routes clicks
// through dispatchHotspot; it never contains player logic of its own.
//
// Pointer handlers use direct `on:pointer*` listeners (not Solid's delegated events)
// because this component is also mounted into a separate PiP document, where Solid's
// delegation — bound to the opener document — wouldn't fire.

import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { playerState } from '../player/playerStore';
import { activeSkin } from '../skins/skinStore';
import { getSkinBitmaps, type SheetBitmaps } from '../skins/skinBitmaps';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import { drawMainWindow, type MainDrawState } from './draw';
import { hitTest, type HotspotName } from './geometry';
import { dispatchHotspot } from './controls';

interface FaceProps {
  /** Current integer render scale (CSS pixels = native * scale). */
  scale: () => number;
  /** rAF/animation source; defaults to the host window. PiP passes its own window. */
  win?: Window;
  /** When provided, dragging the skin title bar reports incremental movement so the
   * host can reposition its window. Omitted in PiP (the OS owns the frame). */
  onMoveBy?: (dx: number, dy: number) => void;
  /** Desktop shell only: the skin's close/shade boxes drive the native window. */
  onClose?: () => void;
  onMinimize?: () => void;
}

const ClassicFace = (props: FaceProps) => {
  let canvas!: HTMLCanvasElement;
  const [bitmaps, setBitmaps] = createSignal<SheetBitmaps | null>(null);
  const [pressed, setPressed] = createSignal<HotspotName | null>(null);
  const [scrollPx, setScrollPx] = createSignal(0);

  const animWin = (): Window => props.win ?? window;

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

  createEffect(() => {
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

  // Marquee loop: only advances while a track is playing and the title overflows.
  let raf = 0;
  let last = 0;
  const loop = (t: number): void => {
    if (last === 0) last = t;
    const dt = t - last;
    last = t;
    if (!playerState.paused && playerState.track) {
      setScrollPx((p) => p + dt * 0.03);
    }
    raf = animWin().requestAnimationFrame(loop);
  };
  onMount(() => {
    render();
    raf = animWin().requestAnimationFrame(loop);
  });
  onCleanup(() => animWin().cancelAnimationFrame(raf));

  // --- Pointer interaction ---------------------------------------------------

  function toNative(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / props.scale(),
      y: (e.clientY - rect.top) / props.scale(),
    };
  }

  let dragging: 'window' | HotspotName | null = null;
  let lastClient = { x: 0, y: 0 };

  function onPointerDown(e: PointerEvent): void {
    const { x, y } = toNative(e);
    const hot = hitTest(x, y);
    canvas.setPointerCapture(e.pointerId);
    // close/shade drive the native window in the desktop shell; elsewhere
    // (browser desktop, PiP) they're host chrome we ignore.
    if (hot === 'close') {
      props.onClose?.();
      return;
    }
    if (hot === 'shade') {
      props.onMinimize?.();
      return;
    }
    if (hot === 'titleBar' || hot === null) {
      if (!props.onMoveBy) return; // not draggable (e.g. PiP)
      dragging = 'window';
      // Screen coords (not client) so dragging stays stable when the move also
      // repositions the native window out from under a captured pointer.
      lastClient = { x: e.screenX, y: e.screenY };
      return;
    }
    dragging = hot;
    setPressed(hot);
    dispatchHotspot(hot, x);
  }

  function onPointerMove(e: PointerEvent): void {
    if (dragging === 'window') {
      const dx = e.screenX - lastClient.x;
      const dy = e.screenY - lastClient.y;
      lastClient = { x: e.screenX, y: e.screenY };
      props.onMoveBy?.(dx, dy);
      return;
    }
    if (dragging === 'posBar' || dragging === 'volume') {
      dispatchHotspot(dragging, toNative(e).x);
    }
  }

  function onPointerUp(e: PointerEvent): void {
    canvas.releasePointerCapture(e.pointerId);
    dragging = null;
    setPressed(null);
  }

  return (
    <canvas
      ref={canvas}
      width={MAIN_WIDTH}
      height={MAIN_HEIGHT}
      style={{
        width: `${MAIN_WIDTH * props.scale()}px`,
        height: `${MAIN_HEIGHT * props.scale()}px`,
        'image-rendering': 'pixelated',
        display: 'block',
        cursor: 'default',
        'touch-action': 'none',
      }}
      on:pointerdown={(e) => onPointerDown(e as PointerEvent)}
      on:pointermove={(e) => onPointerMove(e as PointerEvent)}
      on:pointerup={(e) => onPointerUp(e as PointerEvent)}
    />
  );
};

export default ClassicFace;
