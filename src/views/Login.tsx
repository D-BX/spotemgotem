import type { Component } from 'solid-js';
import { beginLogin } from '../auth/spotifyAuth';
import { setError } from '../stores/auth';

const Login: Component = () => {
  const onConnect = (): void => {
    void beginLogin().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <main style={{ 'font-family': 'var(--font-sans)', padding: 'var(--sp-7)' }}>
      <h1>spotemgotem</h1>
      <p>A personal player for your Spotify library.</p>
      <button type="button" onClick={onConnect}>
        Connect with Spotify
      </button>
      <p style={{ color: 'var(--text-muted)', 'font-size': 'var(--fs-sm)', 'margin-top': 'var(--sp-7)' }}>
        Content and playback provided by Spotify. This app is not affiliated with
        or endorsed by Spotify.
      </p>
    </main>
  );
};

export default Login;
