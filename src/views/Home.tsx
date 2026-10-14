import { Show, createSignal, type Component } from 'solid-js';
import { logout } from '../auth/spotifyAuth';
import { disconnectPlayer, playUri } from '../player/spotifyPlayer';
import { playerState } from '../player/playerStore';
import { profile, setProfile, setStatus } from '../stores/auth';
import PlayerBar from './PlayerBar';

const Home: Component = () => {
  const user = () => profile();
  const [link, setLink] = createSignal('');
  const [playError, setPlayError] = createSignal<string | null>(null);

  const onLogout = (): void => {
    disconnectPlayer();
    logout();
    setProfile(null);
    setStatus('anonymous');
  };

  const onPlay = (e: Event): void => {
    e.preventDefault();
    setPlayError(null);
    void playUri(link()).catch((err: unknown) =>
      setPlayError(err instanceof Error ? err.message : String(err)),
    );
  };

  const avatar = () => user()?.images?.[0]?.url;

  return (
    <>
      <main
        style={{
          'font-family': 'system-ui, sans-serif',
          padding: '2rem',
          'padding-bottom': '6rem',
        }}
      >
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

        {/* Temporary M2 testing aid: start playback from a pasted Spotify link.
            Replaced by real library/search browsing in Milestone 3. */}
        <section style={{ 'margin-top': '2rem' }}>
          <h2 style={{ 'font-size': '1rem' }}>Play a Spotify link (testing)</h2>
          <form onSubmit={onPlay} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="spotify:track:… or https://open.spotify.com/…"
              value={link()}
              onInput={(e) => setLink(e.currentTarget.value)}
              style={{ flex: 1, 'max-width': '32rem' }}
            />
            <button type="submit" disabled={!playerState.isReady}>
              Play
            </button>
          </form>
          <Show when={playError()}>
            {(msg) => <p style={{ color: '#c0392b' }}>{msg()}</p>}
          </Show>
          <Show when={playerState.error}>
            {(msg) => <p style={{ color: '#c0392b' }}>{msg()}</p>}
          </Show>
        </section>

        <p style={{ color: '#888', 'font-size': '0.8rem', 'margin-top': '2rem' }}>
          Content and playback provided by Spotify.
        </p>
      </main>

      <PlayerBar />
    </>
  );
};

export default Home;
