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
  color: '#eee',
  background: '#121212',
  'border-radius': '0.5rem',
  padding: '0.75rem',
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
          gap: '1rem',
          'max-width': '20rem',
          'margin-bottom': '1.5rem',
          background: 'linear-gradient(135deg, #4b0082, #8a2be2)',
        }}
      >
        <div style={{ 'font-size': '2rem' }}>♥</div>
        <div style={{ 'font-weight': 'bold' }}>Liked Songs</div>
      </A>

      <h2 style={{ 'font-size': '1rem', color: '#bbb' }}>Saved Albums</h2>
      <Show
        when={albums.data()}
        fallback={<div style={{ color: '#666' }}>Loading…</div>}
      >
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<div style={{ color: '#666' }}>No saved albums.</div>}
          >
            <div
              style={{
                display: 'grid',
                'grid-template-columns': 'repeat(auto-fill, minmax(10rem, 1fr))',
                gap: '1rem',
              }}
            >
              <For each={list()}>{(album) => <AlbumCard album={album} />}</For>
            </div>
          </Show>
        )}
      </Show>

      <Show when={albums.error()}>
        {(e) => <p style={{ color: '#c0392b' }}>{e().message}</p>}
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
          style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': '0.25rem', 'object-fit': 'cover' }}
        />
      )}
    </Show>
    <div
      style={{
        'margin-top': '0.5rem',
        'font-weight': 'bold',
        'font-size': '0.9rem',
        'white-space': 'nowrap',
        overflow: 'hidden',
        'text-overflow': 'ellipsis',
      }}
    >
      {props.album.name}
    </div>
    <div
      style={{
        color: '#9aa',
        'font-size': '0.8rem',
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
