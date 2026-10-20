// Typed access to the Electron preload bridge (electron/preload.cjs). When the
// app runs inside the desktop shell, `window.desktop` exists and lets the skin's
// own title bars drive the frameless native window (move / resize / minimize /
// close). In a plain browser or installed PWA it's absent, and `desktop` is null
// so callers fall back to in-page behaviour.

export interface DesktopBridge {
  readonly isDesktop: true;
  moveBy(dx: number, dy: number): void;
  resize(w: number, h: number): void;
  minimize(): void;
  close(): void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | null =
  typeof window !== 'undefined' && window.desktop ? window.desktop : null;
