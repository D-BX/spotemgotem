// The classic main window rendered to fill a Document Picture-in-Picture window.
// It's the same 275x116 face as ClassicPlayer, but sized to the PiP viewport and
// without the in-page chrome (no skin toolbar, no window dragging — the OS owns the
// PiP window frame). It reads the shared playerState and routes clicks through the
// shared dispatchHotspot, so it stays in lockstep with the in-page player.
//
// Because a PiP window is a separate document, this component is mounted with its
// own Solid root (see pip.tsx) and uses direct `on:pointer*` listeners rather than
// Solid's delegated events, which bind to the opener document.

import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { playerState } from '../player/playerStore';
import { activeSkin } from '../skins/skinStore';
import { getSkinBitmaps, type SheetBitmaps } from '../skins/skinBitmaps';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import { drawMainWindow, type MainDrawState } from './draw';
import { hitTest } from './geometry';
import { dispatchHotspot } from './controls';

interface PipPlayerProps {
  win: Window;
}

const ClassicPipPlayer = (props: PipPlayerProps) => {
  let canvas!: HTMLCanvasElement;
  const [bitmaps, setBitmaps] = createSignal<SheetBitmaps | null>(null);
  const [scale, setScale] = createSignal(2);
  const [pressed, setPressed] = createSignal<ReturnType<typeof hitTest>>(null);
  const [scrollPx, setScrollPx] = createSignal(0);

  // Fit the 275x116 face to the PiP viewport, keeping whole-pixel scaling so the
  // skin stays crisp. Recompute whenever the user resizes the PiP window.
  function fit(): void {
    const s = Math.max(
      1,
      Math.floor(Math.min(props.win.innerWidth / MAIN_WIDTH, props.win.innerHeight / MAIN_HEIGHT)),
    );
    setScale(s);
  }

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

  // Marquee loop driven by the PiP window's own rAF so it keeps ticking while the
  // PiP window is focused and the opener tab is backgrounded.
  let raf = 0;
  let last = 0;
  const loop = (t: number): void => {
    if (last === 0) last = t;
    const dt = t - last;
    last = t;
    if (!playerState.paused && playerState.track) {
      setScrollPx((p) => p + dt * 0.03);
    }
    raf = props.win.requestAnimationFrame(loop);
  };

  const onResize = (): void => fit();

  onMount(() => {
    fit();
    render();
    raf = props.win.requestAnimationFrame(loop);
    props.win.addEventListener('resize', onResize);
  });
  onCleanup(() => {
    props.win.cancelAnimationFrame(raf);
    props.win.removeEventListener('resize', onResize);
  });

  // --- Interaction -----------------------------------------------------------

  function toNative(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale(),
      y: (e.clientY - rect.top) / scale(),
    };
  }

  let dragging: ReturnType<typeof hitTest> = null;

  function onPointerDown(e: PointerEvent): void {
    const { x, y } = toNative(e);
    const hot = hitTest(x, y);
    canvas.setPointerCapture(e.pointerId);
    // The OS owns the PiP frame, so close/titleBar/shade aren't actionable here;
    // only transport + sliders dispatch. Closing is done from the opener UI.
    if (hot === null || hot === 'titleBar' || hot === 'close' || hot === 'shade') return;
    dragging = hot;
    setPressed(hot);
    dispatchHotspot(hot, x);
  }

  function onPointerMove(e: PointerEvent): void {
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        background: '#000',
        'touch-action': 'none',
        'user-select': 'none',
      }}
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
        on:pointerdown={(e) => onPointerDown(e as PointerEvent)}
        on:pointermove={(e) => onPointerMove(e as PointerEvent)}
        on:pointerup={(e) => onPointerUp(e as PointerEvent)}
      />
    </div>
  );
};

export default ClassicPipPlayer;
