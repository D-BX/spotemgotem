// App shell for the authenticated experience: a sidebar (primary nav + the
// user's playlists), a header with profile/logout, the routed content, and the
// persistent PlayerBar.

import { For, Show, type Component } from 'solid-js';
import { A, type RouteSectionProps } from '@solidjs/router';
import { getMyPlaylists } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { logout } from '../auth/spotifyAuth';
import { disconnectPlayer } from '../player/spotifyPlayer';
import { profile, setProfile, setStatus } from '../stores/auth';
import PlayerBar from './PlayerBar';

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
        'font-family': 'system-ui, sans-serif',
        background: '#000',
        color: '#eee',
      }}
    >
      <nav
        style={{
          'grid-row': '1',
          'grid-column': '1',
          background: '#0b0b0b',
          padding: '1rem',
          overflow: 'auto',
          'border-right': '1px solid #1e1e1e',
        }}
      >
        <div style={{ 'font-weight': 'bold', 'margin-bottom': '1rem' }}>spotemgotem</div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>
          <A href="/" end>Home</A>
          <A href="/search">Search</A>
          <A href="/queue">Queue</A>
          <A href="/collection/tracks">Liked Songs</A>
        </div>
        <hr style={{ 'border-color': '#1e1e1e', margin: '1rem 0' }} />
        <div style={{ color: '#888', 'font-size': '0.75rem', 'margin-bottom': '0.5rem' }}>
          PLAYLISTS
        </div>
        <Show when={playlists.data()} fallback={<div style={{ color: '#666' }}>Loading…</div>}>
          {(list) => (
            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.35rem' }}>
              <For each={list()}>
                {(p) => (
                  <A
                    href={`/playlist/${p.id}`}
                    style={{ color: '#ccc', 'text-decoration': 'none', 'font-size': '0.9rem' }}
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
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            'border-bottom': '1px solid #1e1e1e',
          }}
        >
          <Show when={profile()}>
            {(u) => <span style={{ color: '#ccc' }}>{u().display_name ?? u().id}</span>}
          </Show>
          <button type="button" onClick={onLogout}>Log out</button>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>{props.children}</main>
      </div>

      <div style={{ 'grid-row': '2', 'grid-column': '1 / 3' }}>
        <PlayerBar />
      </div>
    </div>
  );
};

export default Layout;
