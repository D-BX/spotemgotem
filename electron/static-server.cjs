// Minimal loopback static server for the packaged app. Electron can't load the
// SPA from file:// and keep the Spotify OAuth redirect working (the redirect URI
// registered with Spotify is http://127.0.0.1:5173/callback), so in production
// the main process serves the built `dist/` over that exact origin and points
// the window at it. Routes without a real file (/callback, /classic, /modern)
// fall back to index.html so the SPA router can handle them — the same behaviour
// Vite's dev server gives in development.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.wsz': 'application/zip',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/** Start a static server rooted at `root`, serving index.html for unknown routes. */
function startServer(root, port, host = '127.0.0.1') {
  const base = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.normalize(path.join(base, urlPath));

        // Block path traversal outside the served root.
        if (filePath !== base && !filePath.startsWith(base + path.sep)) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        let ext = path.extname(filePath);
        const hasFile = ext && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        if (!hasFile) {
          // SPA fallback.
          filePath = path.join(base, 'index.html');
          ext = '.html';
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404).end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch {
        res.writeHead(500).end('Server error');
      }
    });
    server.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });
}

module.exports = { startServer };
