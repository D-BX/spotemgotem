// Standalone classic experience mounted at /classic, with no modern sidebar/header.
// This is the "Winamp as its own app" view: the main player, the queue window, and
// the media-library window float over a full-viewport backdrop. Installed as a PWA
// (start_url=/classic, display=standalone) it opens straight into this chromeless
// shell. A thin control strip toggles the windows and links back to the full UI.

import { For, Show, Suspense, lazy, onCleanup, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import {
  classicOpen,
  setClassicOpen,
  playlistOpen,
  setPlaylistOpen,
  libraryOpen,
  setLibraryOpen,
  type ClassicWindowProps,
} from './uiState';
import { openPip, closePip, pipSupported, isPipOpen } from './pip';

const ClassicPlayer = lazy(() => import('./ClassicPlayer'));
const ClassicPlaylist = lazy(() => import('./ClassicPlaylist'));
const ClassicLibrary = lazy(() => import('./ClassicLibrary'));

interface Toggle {
  label: string;
  open: () => boolean;
  set: (v: boolean) => void;
}

interface TiledLayout {
  player: ClassicWindowProps;
  queue: ClassicWindowProps;
  library: ClassicWindowProps;
}

// Place the three windows side-by-side/stacked so they're all visible at once,
// rather than each centering itself on top of the others. They stay draggable,
// so this is only the opening arrangement.
function computeLayout(): TiledLayout {
  const gap = 24;
  const scale = Math.max(
    2,
    Math.min(3, Math.floor(Math.min(window.innerWidth / 760, window.innerHeight / 480))),
  );
  const mainW = MAIN_WIDTH * scale;
  const mainH = MAIN_HEIGHT * scale;
  const toolbarH = 40; // the player's unscaled skin toolbar below its canvas
  return {
    player: { initialX: gap, initialY: gap, initialScale: scale },
    queue: { initialX: gap, initialY: gap + mainH + toolbarH + gap, initialScale: scale },
    library: { initialX: gap + mainW + gap, initialY: gap, initialScale: scale },
  };
}

const ClassicApp = () => {
  const layout = computeLayout();

  // Open every window by default — this view is the whole point, so there should
  // be something on screen immediately rather than an empty backdrop.
  onMount(() => {
    setClassicOpen(true);
    setPlaylistOpen(true);
    setLibraryOpen(true);
  });

  // Leaving /classic (e.g. "Full UI") shouldn't leave the windows + backdrop
  // covering the modern Layout, so close them all on unmount. Also close any PiP
  // window so it doesn't outlive the view that spawned it.
  onCleanup(() => {
    setClassicOpen(false);
    setPlaylistOpen(false);
    setLibraryOpen(false);
    closePip();
  });

  const toggles: Toggle[] = [
    { label: 'Player', open: classicOpen, set: setClassicOpen },
    { label: 'Queue', open: playlistOpen, set: setPlaylistOpen },
    { label: 'Library', open: libraryOpen, set: setLibraryOpen },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        'font-family': 'var(--font-sans)',
        background:
          'radial-gradient(circle at 50% 30%, #2a2a33 0%, #141418 60%, #0a0a0c 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Control strip: toggle each window and escape back to the modern UI. */}
      <div
        style={{
          position: 'fixed',
          top: '0',
          left: '50%',
          transform: 'translateX(-50%)',
          'z-index': '1001',
          display: 'flex',
          gap: '0.4rem',
          'align-items': 'center',
          padding: '0.4rem 0.75rem',
          'font-size': '0.8rem',
          color: '#eee',
          background: 'rgba(0,0,0,0.55)',
          'border-radius': '0 0 0.5rem 0.5rem',
          'backdrop-filter': 'blur(4px)',
        }}
      >
        <For each={toggles}>
          {(t) => (
            <button
              type="button"
              onClick={() => t.set(!t.open())}
              aria-pressed={t.open()}
              style={{
                'font-size': '0.75rem',
                padding: '0.2rem 0.5rem',
                opacity: t.open() ? '1' : '0.55',
              }}
            >
              {t.label}
            </button>
          )}
        </For>
        <span style={{ width: '1px', height: '1rem', background: 'rgba(255,255,255,0.25)' }} />
        <Show when={pipSupported()}>
          <button
            type="button"
            onClick={() => (isPipOpen() ? closePip() : void openPip())}
            aria-pressed={isPipOpen()}
            title="Float the player over other windows (Picture-in-Picture)"
            style={{ 'font-size': '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            {isPipOpen() ? 'Close pop-out' : 'Pop out'}
          </button>
        </Show>
        <A href="/" style={{ color: '#9ecbff', 'text-decoration': 'none', 'font-size': '0.75rem' }}>
          Full UI
        </A>
      </div>

      <Suspense>
        <Show when={classicOpen()}>
          <ClassicPlayer {...layout.player} />
        </Show>
        <Show when={playlistOpen()}>
          <ClassicPlaylist {...layout.queue} />
        </Show>
        <Show when={libraryOpen()}>
          <ClassicLibrary {...layout.library} />
        </Show>
      </Suspense>
    </div>
  );
};

export default ClassicApp;
