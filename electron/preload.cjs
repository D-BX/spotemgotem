// Preload bridge for the frameless window. The window has no OS title bar, so the
// skin's own title bars must move/close the native window. We expose a tiny, typed
// surface on `window.desktop` and route each call to the main process over IPC.
// contextIsolation stays on; nothing from Node leaks into the page beyond this.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** Mark that we're running inside the Electron shell (vs. a browser/PWA). */
  isDesktop: true,
  /** Move the native window by a pixel delta (frameless drag). */
  moveBy: (dx, dy) => ipcRenderer.send('win:moveBy', Math.round(dx), Math.round(dy)),
  /** Resize the window's content area to exactly wrap the skin. */
  resize: (w, h) => ipcRenderer.send('win:resize', Math.round(w), Math.round(h)),
  /** Minimize / close the native window (skin title-bar controls). */
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
});
