// Static auth configuration. Fails loudly at module load if the Client ID is
// missing rather than silently producing a broken login URL.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

if (!CLIENT_ID) {
  throw new Error(
    'VITE_SPOTIFY_CLIENT_ID is not set. Copy .env.example to .env and add your ' +
      'Spotify app Client ID from the Developer Dashboard.',
  );
}

export const SPOTIFY_CLIENT_ID: string = CLIENT_ID;

// Must match the redirect URI registered in the Spotify Dashboard exactly.
// Spotify rejects `localhost`, so we use the loopback IP. The dev server is
// pinned to this host/port in vite.config.ts.
export const REDIRECT_URI = 'http://127.0.0.1:5173/callback';

// Scopes requested so far. `streaming` + playback-state/modify are required by
// the Web Playback SDK (Milestone 2). Changing this set triggers a fresh consent
// screen, so an existing session must log in again to grant the new scopes.
export const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

export const AUTH_URL = 'https://accounts.spotify.com/authorize';
export const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const API_BASE_URL = 'https://api.spotify.com/v1';
