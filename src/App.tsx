// Root component. Handles the auth bootstrap (callback / silent refresh), kicks
// off the Web Playback SDK once authenticated, and then mounts the router with
// Layout as the app shell. View components are lazy-loaded for code splitting.

import {
  Match,
  Show,
  Switch,
  createEffect,
  lazy,
  onMount,
  type Component,
} from 'solid-js';
import { Route, Router } from '@solidjs/router';
import {
  getValidAccessToken,
  handleCallback,
  hasRequiredScopes,
  hasStoredSession,
  isCallbackUrl,
  logout,
} from './auth/spotifyAuth';
import { getCurrentUser } from './api/spotify';
import { initializePlayer } from './player/spotifyPlayer';
import { error, setError, setProfile, setStatus, status } from './stores/auth';
import Login from './views/Login';
import Layout from './views/Layout';

const Library = lazy(() => import('./views/Library'));
const Playlist = lazy(() => import('./views/Playlist'));
const Album = lazy(() => import('./views/Album'));
const LikedSongs = lazy(() => import('./views/LikedSongs'));
const Search = lazy(() => import('./views/Search'));
const Queue = lazy(() => import('./views/Queue'));

async function loadProfile(): Promise<void> {
  const user = await getCurrentUser();
  setProfile(user);
  setStatus('authed');
}

const App: Component = () => {
  onMount(async () => {
    try {
      if (isCallbackUrl()) {
        await handleCallback();
        await loadProfile();
        return;
      }
      if (hasStoredSession()) {
        if (!hasRequiredScopes()) {
          // The stored grant predates the app's current scopes. Drop it and
          // require a fresh consent instead of refreshing an under-scoped token.
          logout();
          setError('New permissions are required. Please reconnect with Spotify.');
          setStatus('anonymous');
          return;
        }
        // Silent refresh from the stored refresh token, then fetch profile.
        await getValidAccessToken();
        await loadProfile();
        return;
      }
      setStatus('anonymous');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('anonymous');
    }
  });

  // Initialize the Web Playback SDK once we are authenticated. initializePlayer
  // guards against double init, so this is safe to run on each status change.
  createEffect(() => {
    if (status() === 'authed') {
      void initializePlayer().catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    }
  });

  return (
    <>
      <Switch>
        <Match when={status() === 'loading'}>
          <p style={{ 'font-family': 'system-ui, sans-serif', padding: '2rem' }}>
            Loading…
          </p>
        </Match>
        <Match when={status() === 'authed'}>
          <Router root={Layout}>
            <Route path="/" component={Library} />
            <Route path="/search" component={Search} />
            <Route path="/queue" component={Queue} />
            <Route path="/collection/tracks" component={LikedSongs} />
            <Route path="/playlist/:id" component={Playlist} />
            <Route path="/album/:id" component={Album} />
          </Router>
        </Match>
        <Match when={status() === 'anonymous'}>
          <Login />
        </Match>
      </Switch>
      <Show when={error()}>
        {(msg) => (
          <p
            role="alert"
            style={{
              position: 'fixed',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              'z-index': 1000,
              'font-family': 'system-ui, sans-serif',
              margin: '0.5rem',
              padding: '0.5rem 1rem',
              'border-radius': '0.5rem',
              background: '#2a0d0d',
              border: '1px solid #c0392b',
              color: '#f5b7b1',
            }}
          >
            {msg()}
          </p>
        )}
      </Show>
    </>
  );
};

export default App;
