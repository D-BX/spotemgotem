import { Show, type Component } from 'solid-js';
import { logout } from '../auth/spotifyAuth';
import { profile, setProfile, setStatus } from '../stores/auth';

const Home: Component = () => {
  const user = () => profile();

  const onLogout = (): void => {
    logout();
    setProfile(null);
    setStatus('anonymous');
  };

  const avatar = () => user()?.images?.[0]?.url;

  return (
    <main style={{ 'font-family': 'system-ui, sans-serif', padding: '2rem' }}>
      <Show when={user()} fallback={<p>Loading profile…</p>}>
        {(u) => (
          <>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem' }}>
              <Show when={avatar()}>
                {(src) => (
                  <img
                    src={src()}
                    alt=""
                    width={64}
                    height={64}
                    style={{ 'border-radius': '50%' }}
                  />
                )}
              </Show>
              <div>
                <h1 style={{ margin: 0 }}>{u().display_name ?? u().id}</h1>
                <p style={{ margin: 0, color: '#888' }}>{u().email}</p>
                <p style={{ margin: 0, color: '#888' }}>Plan: {u().product}</p>
              </div>
            </div>
            <button type="button" onClick={onLogout} style={{ 'margin-top': '1.5rem' }}>
              Log out
            </button>
          </>
        )}
      </Show>
      <p style={{ color: '#888', 'font-size': '0.8rem', 'margin-top': '2rem' }}>
        Content and playback provided by Spotify.
      </p>
    </main>
  );
};

export default Home;
