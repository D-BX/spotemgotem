// Dev launcher: start Vite, wait for it to answer on 127.0.0.1:5173, then launch
// Electron pointed at it (ELECTRON_DEV=1). Keeps both lifecycles tied together so
// Ctrl-C or quitting the app stops both. Avoids extra deps (concurrently/wait-on).

const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const root = path.join(__dirname, '..');
const bin = (name) => path.join(root, 'node_modules', '.bin', name);
const HOST = '127.0.0.1';
const PORT = 5173;

// Pre-flight: if something is ALREADY listening on :5173, another instance of the
// app is almost certainly running. Launching anyway would point a second Electron
// at that foreign server — two windows, and (fatal for us) two Spotify Connect
// devices both named "spotemgotem" fighting over playback, which shows up as songs
// jumping/auto-advancing randomly and the UI desyncing. Refuse instead so the
// cause is obvious rather than a mysterious playback glitch.
function assertPortFree() {
  return new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(
            new Error(
              `Port ${PORT} is already in use — another instance of the app is ` +
                `probably still running. Quit it (close the window / Ctrl-C the ` +
                `other terminal) before running \`pnpm electron:dev\` again. ` +
                `Running two at once creates duplicate Spotify devices and makes ` +
                `playback skip to random songs.`,
            ),
          );
        } else {
          reject(err);
        }
      })
      .once('listening', () => tester.close(resolve))
      .listen(PORT, HOST);
  });
}

let vite = null;
let viteExited = false;

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      // If Vite died (e.g. a config/port error), stop waiting — otherwise we'd
      // keep polling and could attach Electron to an unrelated server.
      if (viteExited) {
        reject(new Error('Vite dev server exited before it was ready.'));
        return;
      }
      const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) reject(new Error('Vite dev server did not come up on :5173'));
        else setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(retries);
  });
}

function shutdown(code) {
  if (vite && !vite.killed) vite.kill();
  process.exit(code ?? 0);
}

assertPortFree()
  .then(() => {
    vite = spawn(bin('vite'), [], { cwd: root, stdio: 'inherit', env: process.env });
    vite.on('exit', () => {
      viteExited = true;
    });
    return waitForServer();
  })
  .then(() => {
    const electron = spawn(bin('electron'), ['.'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_DEV: '1' },
    });
    electron.on('exit', (code) => shutdown(code ?? 0));
  })
  .catch((err) => {
    console.error(err.message);
    shutdown(1);
  });

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
