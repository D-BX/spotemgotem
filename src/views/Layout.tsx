// App shell for the authenticated experience: a sidebar (primary nav + the
// user's playlists), a header with the theme picker and profile/logout, the
// routed content, and the persistent PlayerBar.

import { For, Show, Suspense, lazy, type Component } from 'solid-js';
import { A, type RouteSectionProps } from '@solidjs/router';
import { getMyPlaylists } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { logout } from '../auth/spotifyAuth';
import { disconnectPlayer } from '../player/spotifyPlayer';
import { profile, setProfile, setStatus } from '../stores/auth';
import ThemePicker from '../themes/ThemePicker';
import PlayerBar from './PlayerBar';
import {
  classicOpen,
  setClassicOpen,
  playlistOpen,
  setPlaylistOpen,
} from '../classic/uiState';

// Lazy so the skin parser + fflate + canvas code form their own chunk, loaded
// only when classic mode first opens.
const ClassicPlayer = lazy(() => import('../classic/ClassicPlayer'));
const ClassicPlaylist = lazy(() => import('../classic/ClassicPlaylist'));

const Layout: Component<RouteSectionProps> = (props) => {
  const playlists = createCachedResource(() => 'me:playlists', getMyPlaylists);

  const onLogout = (): void => {
    disconnectPlayer();
    logout();
    setProfile(null);
    setStatus('anonymous');
  };

  return (
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '16rem 1fr',
        'grid-template-rows': '1fr auto',
        height: '100vh',
        'font-family': 'var(--font-sans)',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <nav
        style={{
          'grid-row': '1',
          'grid-column': '1',
          background: 'var(--bg-sidebar)',
          padding: 'var(--sp-5)',
          overflow: 'auto',
          'border-right': '1px solid var(--border)',
        }}
      >
        <div style={{ 'font-weight': 'bold', 'margin-bottom': 'var(--sp-5)' }}>spotemgotem</div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--sp-3)' }}>
          <A href="/" end>Home</A>
          <A href="/search">Search</A>
          <A href="/queue">Queue</A>
          <A href="/collection/tracks">Liked Songs</A>
        </div>
        <hr style={{ 'border-color': 'var(--border)', margin: 'var(--sp-5) 0' }} />
        <div style={{ color: 'var(--text-muted)', 'font-size': 'var(--fs-xs)', 'margin-bottom': 'var(--sp-3)' }}>
          PLAYLISTS
        </div>
        <Show when={playlists.data()} fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}>
          {(list) => (
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--sp-2)' }}>
              <For each={list()}>
                {(p) => (
                  <A
                    href={`/playlist/${p.id}`}
                    style={{ color: 'var(--text-secondary)', 'text-decoration': 'none', 'font-size': 'var(--fs-md)' }}
                  >
                    {p.name}
                  </A>
                )}
              </For>
            </div>
          )}
        </Show>
      </nav>

      <div style={{ 'grid-row': '1', 'grid-column': '2', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
        <header
          style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'flex-end',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-4) var(--sp-5)',
            'border-bottom': '1px solid var(--border)',
          }}
        >
          <ThemePicker />
          <button
            type="button"
            onClick={() => setClassicOpen((v) => !v)}
            aria-pressed={classicOpen()}
          >
            {classicOpen() ? 'Hide Classic' : 'Classic'}
          </button>
          <button
            type="button"
            onClick={() => setPlaylistOpen((v) => !v)}
            aria-pressed={playlistOpen()}
          >
            {playlistOpen() ? 'Hide Playlist' : 'Playlist'}
          </button>
          <Show when={profile()}>
            {(u) => <span style={{ color: 'var(--text-secondary)' }}>{u().display_name ?? u().id}</span>}
          </Show>
          <button type="button" onClick={onLogout}>Log out</button>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--sp-6)' }}>{props.children}</main>
      </div>

      <div style={{ 'grid-row': '2', 'grid-column': '1 / 3' }}>
        <PlayerBar />
      </div>

      {/* Full-viewport backdrop so classic mode takes over the page (and blocks
          clicks to the modern UI underneath). The skin's own close button exits. */}
      <Show when={classicOpen() || playlistOpen()}>
        <div
          style={{
            position: 'fixed',
            inset: '0',
            'z-index': '998',
            background:
              'radial-gradient(circle at 50% 30%, #2a2a33 0%, #141418 60%, #0a0a0c 100%)',
          }}
        />
      </Show>

      <Suspense>
        <Show when={classicOpen()}>
          <ClassicPlayer />
        </Show>
        <Show when={playlistOpen()}>
          <ClassicPlaylist />
        </Show>
      </Suspense>
    </div>
  );
};

export default Layout;
