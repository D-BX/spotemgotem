// The user's saved tracks ("Liked Songs"). This can be thousands of rows, so the
// list is virtualized. Liked Songs has no playable context URI, so clicking a row
// plays that single track immediately.

import { Show, createMemo, type Component } from 'solid-js';
import { getSavedTracks } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { playTrack } from '../player/spotifyPlayer';
import { setError } from '../stores/auth';
import TrackList, { type TrackRow } from '../components/TrackList';
import type { Track } from '../api/types';

const LikedSongs: Component = () => {
  const resource = createCachedResource<Track[]>(
    () => 'me:tracks',
    getSavedTracks,
  );

  const rows = createMemo<TrackRow[]>(() => resource.data() ?? []);

  const onPlay = (track: TrackRow): void => {
    void playTrack(track.uri).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <header style={{ 'margin-bottom': '1rem' }}>
        <div style={{ color: '#9aa', 'font-size': '0.8rem' }}>Playlist</div>
        <h1 style={{ margin: '0.25rem 0' }}>Liked Songs</h1>
        <Show when={resource.data()}>
          {(list) => (
            <div style={{ color: '#888', 'font-size': '0.85rem' }}>{list().length} tracks</div>
          )}
        </Show>
      </header>
      <Show
        when={resource.data()}
        fallback={<div style={{ color: '#666' }}>Loading…</div>}
      >
        <div style={{ flex: 1, 'min-height': 0 }}>
          <TrackList tracks={rows()} onPlay={onPlay} height="100%" />
        </div>
      </Show>
      <Show when={resource.error()}>
        {(e) => <p style={{ color: '#c0392b' }}>{e().message}</p>}
      </Show>
    </div>
  );
};

export default LikedSongs;
