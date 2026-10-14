import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Dev server is pinned to 127.0.0.1:5173 so the redirect URI registered with
// Spotify (http://127.0.0.1:5173/callback) matches exactly. Spotify rejects
// `localhost`, and strictPort avoids silently drifting to another port which
// would break the redirect. Default appType 'spa' serves index.html for
// /callback.
export default defineConfig({
  plugins: [solid()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
