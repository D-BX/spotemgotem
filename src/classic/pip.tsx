// Document Picture-in-Picture lifecycle for the classic player. Opens a real OS
// PiP window (Chromium), mounts a dedicated Solid root into its document, and tears
// everything down when the window closes — whether that's via closePip() here or the
// user clicking the OS close button. Feature-detected; the "Pop out" button is only
// shown when pipSupported() is true.

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import ClassicPipPlayer from './ClassicPipPlayer';

// Native main-window size; the PiP window opens at 2x so the skin is legible.
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';

const [pipOpen, setPipOpen] = createSignal(false);
export const isPipOpen = pipOpen;

export function pipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

let pipWindow: Window | null = null;
let dispose: (() => void) | null = null;

/** Minimal reset page styling for the PiP document (its own fresh document has UA
 * margins we don't want). */
function injectStyle(win: Window): void {
  const style = win.document.createElement('style');
  style.textContent = `
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    * { box-sizing: border-box; }
  `;
  win.document.head.appendChild(style);
}

function teardown(): void {
  dispose?.();
  dispose = null;
  pipWindow = null;
  setPipOpen(false);
}

export async function openPip(): Promise<void> {
  if (!pipSupported() || pipWindow) return;
  const dpip = window.documentPictureInPicture;
  if (!dpip) return;

  const win = await dpip.requestWindow({
    width: MAIN_WIDTH * 2,
    height: MAIN_HEIGHT * 2,
  });
  pipWindow = win;
  injectStyle(win);

  const mount = win.document.createElement('div');
  mount.style.height = '100%';
  win.document.body.appendChild(mount);

  // Mount a fresh Solid root inside the PiP document. Solid's delegated events bind
  // to the opener document, so ClassicPipPlayer uses direct on:pointer* listeners.
  dispose = render(() => <ClassicPipPlayer win={win} />, mount);

  // The user closing the PiP window (OS chrome) fires pagehide on it.
  win.addEventListener('pagehide', teardown, { once: true });
  setPipOpen(true);
}

export function closePip(): void {
  if (pipWindow) {
    // Closing fires pagehide -> teardown(); guard in case it doesn't.
    const win = pipWindow;
    win.close();
  }
  teardown();
}
