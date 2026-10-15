// Home/library landing: a "Liked Songs" shortcut tile plus a grid of the user's
// saved albums. Albums come from the stale-while-revalidate cache so a revisit
// paints instantly before refreshing.

import { For, Show, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { getSavedAlbums } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import type { AlbumSummary } from '../api/types';

const CARD = {
  display: 'block',
  'text-decoration': 'none',
  color: 'var(--text)',
  background: 'var(--bg-card)',
  'border-radius': 'var(--radius-md)',
  padding: 'var(--sp-4)',
} as const;

const Library: Component = () => {
  const albums = createCachedResource(() => 'me:albums', getSavedAlbums);

  return (
    <div>
      <h1 style={{ 'margin-top': 0 }}>Library</h1>

      <A
        href="/collection/tracks"
        style={{
          ...CARD,
          display: 'flex',
          'align-items': 'center',
          gap: 'var(--sp-5)',
          'max-width': '20rem',
          'margin-bottom': 'var(--sp-6)',
          background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
        }}
      >
        <div style={{ 'font-size': 'var(--fs-lg)' }}>♥</div>
        <div style={{ 'font-weight': 'bold' }}>Liked Songs</div>
      </A>

      <h2 style={{ 'font-size': 'var(--fs-base)', color: 'var(--text-section)' }}>Saved Albums</h2>
      <Show
        when={albums.data()}
        fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}
      >
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<div style={{ color: 'var(--text-disabled)' }}>No saved albums.</div>}
          >
            <div
              style={{
                display: 'grid',
                'grid-template-columns': 'repeat(auto-fill, minmax(10rem, 1fr))',
                gap: 'var(--sp-5)',
              }}
            >
              <For each={list()}>{(album) => <AlbumCard album={album} />}</For>
            </div>
          </Show>
        )}
      </Show>

      <Show when={albums.error()}>
        {(e) => <p style={{ color: 'var(--error-border)' }}>{e().message}</p>}
      </Show>
    </div>
  );
};

const AlbumCard: Component<{ album: AlbumSummary }> = (props) => (
  <A href={`/album/${props.album.id}`} style={CARD}>
    <Show when={props.album.images[0]?.url}>
      {(src) => (
        <img
          src={src()}
          alt=""
          style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': 'var(--radius-sm)', 'object-fit': 'cover' }}
        />
      )}
    </Show>
    <div
      style={{
        'margin-top': 'var(--sp-3)',
        'font-weight': 'bold',
        'font-size': 'var(--fs-md)',
        'white-space': 'nowrap',
        overflow: 'hidden',
        'text-overflow': 'ellipsis',
      }}
    >
      {props.album.name}
    </div>
    <div
      style={{
        color: 'var(--text-subtle)',
        'font-size': 'var(--fs-sm)',
        'white-space': 'nowrap',
        overflow: 'hidden',
        'text-overflow': 'ellipsis',
      }}
    >
      {props.album.artists.map((a) => a.name).join(', ')}
    </div>
  </A>
);

export default Library;
