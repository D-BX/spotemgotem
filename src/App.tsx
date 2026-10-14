import { Match, Show, Switch, onMount, type Component } from 'solid-js';
import {
  getValidAccessToken,
  handleCallback,
  hasStoredSession,
  isCallbackUrl,
} from './auth/spotifyAuth';
import { getCurrentUser } from './api/client';
import { error, setError, setProfile, setStatus, status } from './stores/auth';
import Login from './views/Login';
import Home from './views/Home';

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

  return (
    <>
      <Switch>
        <Match when={status() === 'loading'}>
          <p style={{ 'font-family': 'system-ui, sans-serif', padding: '2rem' }}>
            Loading…
          </p>
        </Match>
        <Match when={status() === 'authed'}>
          <Home />
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
              'font-family': 'system-ui, sans-serif',
              padding: '0 2rem',
              color: '#c0392b',
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
