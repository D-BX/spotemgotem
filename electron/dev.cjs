// Dev launcher: start Vite, wait for it to answer on 127.0.0.1:5173, then launch
// Electron pointed at it (ELECTRON_DEV=1). Keeps both lifecycles tied together so
// Ctrl-C or quitting the app stops both. Avoids extra deps (concurrently/wait-on).

const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.join(__dirname, '..');
const bin = (name) => path.join(root, 'node_modules', '.bin', name);

const vite = spawn(bin('vite'), [], { cwd: root, stdio: 'inherit', env: process.env });

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://127.0.0.1:5173/`, (res) => {
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
  if (!vite.killed) vite.kill();
  process.exit(code ?? 0);
}

waitForServer()
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
