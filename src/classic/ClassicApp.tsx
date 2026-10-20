// The classic experience as a single, cohesive window: the skin player on top and a
// side-tabbed browser (Queue / Playlists / Liked / Skins) below. It replaces the old
// trio of free-floating windows, so nothing overlaps and the whole thing reads as one
// app. Mounted at `/` (and the `/classic` alias) with no modern chrome; installed as a
// PWA it opens straight here.
//
// This shell owns only chrome and layout. The player face (ClassicFace) and the browser
// (ClassicList) read the shared playerState and call the existing control functions —
// no new player logic lives here. Skin picking/importing and the Pop out / Full UI
// actions live inside ClassicList's rail, so there's no separate toolbar.

import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import { PLAYLIST_HEIGHT } from './geometry';
import { loadSkinFromFile } from '../skins/skinStore';
import { playerState, setPlayerState } from '../player/playerStore';
import { desktop } from './desktop';
import { closePip } from './pip';
import ClassicFace from './ClassicFace';
import ClassicList from './ClassicList';

// Total skin height (player face + playlist browser), in native skin pixels.
const SKIN_H = MAIN_HEIGHT + PLAYLIST_HEIGHT;

// In the Electron shell the whole window is the skin, so we pick one fixed,
// crisp integer scale and ask the shell to size its frameless window to match.
const DESKTOP_SCALE = 2;

function fitScale(): number {
  const avail = window.innerHeight * 0.94;
  const s = Math.floor(avail / SKIN_H);
  return Math.max(1, Math.min(3, s));
}

const ClassicApp = () => {
  // Desktop: fixed scale, window wraps the skin. Browser/PWA: fit to viewport.
  const [scale, setScale] = createSignal(desktop ? DESKTOP_SCALE : 2);
  const [pos, setPos] = createSignal(desktop ? { x: 0, y: 0 } : { x: 24, y: 24 });

  function place(): void {
    if (desktop) {
      // Size the native window's content area to exactly wrap the scaled skin,
      // so there's no OS chrome and no empty margin — the skin fills the window.
      setScale(DESKTOP_SCALE);
      setPos({ x: 0, y: 0 });
      desktop.resize(MAIN_WIDTH * DESKTOP_SCALE, SKIN_H * DESKTOP_SCALE);
      return;
    }
    const s = fitScale();
    setScale(s);
    setPos((p) => ({
      x: Math.max(8, Math.round((window.innerWidth - MAIN_WIDTH * s) / 2)),
      y: p.y,
    }));
  }

  const onResize = (): void => place();

  // Dragging a skin title bar moves the native window in the desktop shell, or
  // repositions the floating skin on the gradient desktop in the browser.
  const moveBy = (dx: number, dy: number): void => {
    if (desktop) desktop.moveBy(dx, dy);
    else setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  onMount(() => {
    place();
    window.addEventListener('resize', onResize);
  });
  onCleanup(() => {
    window.removeEventListener('resize', onResize);
    closePip(); // don't leave a popped-out window behind when leaving the view
  });

  // Drag & drop a .wsz anywhere on the window to apply it.
  function onDrop(e: DragEvent): void {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && /\.wsz$/i.test(file.name)) void loadSkinFromFile(file);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        'font-family': 'var(--font-sans)',
        // In the desktop shell the window is the skin, so no gradient "desktop".
        background: desktop
          ? '#0a0a0c'
          : 'radial-gradient(circle at 50% 30%, #2a2a33 0%, #141418 60%, #0a0a0c 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed',
          left: `${pos().x}px`,
          top: `${pos().y}px`,
          'z-index': '1000',
          'user-select': 'none',
          // The drop shadow only makes sense for the floating browser desktop.
          filter: desktop ? undefined : 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {/* Skin player face — drag its title bar to move the whole window;
            its close box quits the native window in the desktop shell. */}
        <ClassicFace
          scale={scale}
          onMoveBy={moveBy}
          onClose={desktop ? () => desktop?.close() : undefined}
          onMinimize={desktop ? () => desktop?.minimize() : undefined}
        />

        {/* Authentic pledit browser window: Queue / Playlists / Liked / Skins. */}
        <ClassicList scale={scale} onMoveBy={moveBy} />
      </div>

      {/* Playback errors have no other home in classic mode; show them here. */}
      <Show when={playerState.error}>
        <div
          role="alert"
          onClick={() => setPlayerState('error', null)}
          title="Dismiss"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'var(--sp-5)',
            transform: 'translateX(-50%)',
            'z-index': '2000',
            'max-width': '90vw',
            cursor: 'pointer',
            padding: 'var(--sp-3) var(--sp-5)',
            'border-radius': 'var(--radius-md)',
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            color: 'var(--error-text)',
            'font-size': 'var(--fs-sm)',
          }}
        >
          {playerState.error}
        </div>
      </Show>
    </div>
  );
};

export default ClassicApp;
