// Electron main process. Runs the classic skin player as a native desktop app.
//
// Both development and production load the app from http://127.0.0.1:5173 so the
// Spotify OAuth redirect URI (http://127.0.0.1:5173/callback) works unchanged:
//   • dev  (ELECTRON_DEV=1): the Vite dev server is already listening there.
//   • prod: we serve the built dist/ over that origin from this process.
// The Spotify consent page loads inside the window and redirects back to the
// loopback origin, which the SPA router handles — no external browser needed.
//
// Widevine: the Spotify Web Playback SDK decrypts audio through EME/Widevine,
// which stock Electron does not bundle (you'd get "EMEError: No supported
// keysystem was found"). This build depends on castlabs' Electron fork, which
// ships a `components` module that fetches & verifies the Widevine CDM at
// startup. We await `components.whenReady()` before opening the window so audio
// can play in-app. See the README for the one-time VMP signing needed to package.
//
// The window is frameless and sized to exactly wrap the skin, so the skin *is*
// the app (no OS chrome, no empty margin). The skin's own title bars move/close
// the window via the preload bridge (ipc: win:moveBy / win:resize / win:close).

const { app, BrowserWindow, shell, ipcMain, components } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./static-server.cjs');

// Diagnostic log for Widevine startup, written to the project root so it can be
// inspected directly (it's gitignored). Rewritten fresh each launch.
const WIDEVINE_LOG = path.join(__dirname, '..', 'widevine-debug.log');
function wlog(line) {
  const entry = `[${new Date().toISOString()}] ${line}`;
  console.log('[widevine]', line);
  try {
    fs.appendFileSync(WIDEVINE_LOG, entry + '\n');
  } catch {
    /* non-fatal: logging must never break startup */
  }
}

const HOST = '127.0.0.1';
const PORT = 5173;
const APP_URL = `http://${HOST}:${PORT}/`;
const DEV = !!process.env.ELECTRON_DEV;

let server = null;
let win = null;

// Google's Component Updater rate-limits background update checks and will answer
// `noupdate / "bandwidth limit"`, so the Widevine CDM never installs (symptom:
// status "not-installed", version null, "No component available" — castlabs
// issue #230). `test-request` tags our update request so the server bypasses that
// throttling and serves the component; `fast-update` skips the initial check
// delay. Must be set before the app is ready.
app.commandLine.appendSwitch('component-updater', 'fast-update,test-request');

async function createWindow() {
  if (!DEV) {
    // Serve the built app ourselves on the loopback origin.
    server = await startServer(path.join(__dirname, '..', 'dist'), PORT, HOST);
  }

  win = new BrowserWindow({
    // Starting size is a sane default; the renderer resizes us (win:resize) to
    // the exact scaled-skin dimensions once it has computed its render scale.
    width: 550,
    height: 696,
    useContentSize: true, // width/height describe the web content, not the frame
    frame: false, // no OS chrome — the skin draws its own title bars
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    title: 'spotemgotem',
    backgroundColor: '#0a0a0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep the app and the Spotify consent page in-window; send anything else to
  // the user's real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL) || url.startsWith('https://accounts.spotify.com')) {
      return { action: 'allow' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    win = null;
  });

  await win.loadURL(APP_URL);
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
}

// --- Frameless window controls (from the preload bridge) --------------------
ipcMain.on('win:moveBy', (_e, dx, dy) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});

ipcMain.on('win:resize', (_e, w, h) => {
  if (!win || !Number.isFinite(w) || !Number.isFinite(h)) return;
  win.setContentSize(Math.max(1, w), Math.max(1, h));
});

ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:close', () => win?.close());

// Fetch & verify the Widevine CDM (castlabs `components`) before opening the
// window, so the Web Playback SDK can initialize EME. The `+wvcus` build
// downloads the CDM from Google's component-update service on first run, so this
// needs a network connection and can fail transiently — we retry a few times and
// log the per-component detail. We ALWAYS open the window afterwards: browsing
// works without Widevine, and the renderer shows a clear message if audio can't
// decrypt (see assertWidevine in spotifyPlayer.ts). `components` is absent on a
// plain (non-castlabs) Electron, which we also handle.
const WIDEVINE_ATTEMPTS = 3;

/** Serialize a ComponentsError (or anything) into the fullest readable detail. */
function widevineErrorDetail(e) {
  const seen = (v) => {
    try {
      return typeof v === 'string' ? v : JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const list = e && Array.isArray(e.errors) ? e.errors : [e];
  const parts = list.map((x) => {
    if (!x) return String(x);
    const bits = [];
    if (x.name) bits.push(x.name);
    if (x.message) bits.push(x.message);
    if (x.detail !== undefined) bits.push(`detail=${seen(x.detail)}`);
    return bits.length ? bits.join(' ') : seen(x);
  });
  return parts.join(' || ');
}

async function waitForWidevine() {
  try {
    fs.writeFileSync(WIDEVINE_LOG, ''); // fresh log each launch
  } catch {
    /* ignore */
  }
  wlog(
    `platform=${process.platform} arch=${process.arch} ` +
      `electron=${process.versions.electron} dev=${DEV}`,
  );

  if (!components || typeof components.whenReady !== 'function') {
    wlog(
      '`components` module not found — not the castlabs build. Audio will fail ' +
        'with an EME error. Run `pnpm install`, then `pnpm electron:dev`.',
    );
    return;
  }

  for (let attempt = 1; attempt <= WIDEVINE_ATTEMPTS; attempt++) {
    try {
      await components.whenReady();
      const status =
        typeof components.status === 'function' ? components.status() : null;
      wlog(`CDM ready ${status ? JSON.stringify(status) : ''}`);
      return;
    } catch (e) {
      wlog(
        `install failed (attempt ${attempt}/${WIDEVINE_ATTEMPTS}): ` +
          widevineErrorDetail(e),
      );
      // Also dump a raw status snapshot — it sometimes names the missing component.
      try {
        if (typeof components.status === 'function') {
          wlog(`status snapshot: ${JSON.stringify(components.status())}`);
        }
      } catch {
        /* ignore */
      }
      if (attempt < WIDEVINE_ATTEMPTS) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  wlog(
    'GAVE UP: could not install the Widevine CDM. It downloads from Google\'s ' +
      'update service on first launch — check network/VPN/firewall and relaunch.',
  );
}

async function boot() {
  await waitForWidevine();
  await createWindow();
}

app.whenReady().then(boot).catch((e) => {
  console.error('Failed to start window:', e);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
