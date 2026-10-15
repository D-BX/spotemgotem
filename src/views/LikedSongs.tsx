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
      <header style={{ 'margin-bottom': 'var(--sp-5)' }}>
        <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-sm)' }}>Playlist</div>
        <h1 style={{ margin: 'var(--sp-1) 0' }}>Liked Songs</h1>
        <Show when={resource.data()}>
          {(list) => (
            <div style={{ color: 'var(--text-muted)', 'font-size': 'var(--fs-smd)' }}>{list().length} tracks</div>
          )}
        </Show>
      </header>
      <Show
        when={resource.data()}
        fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}
      >
        <div style={{ flex: 1, 'min-height': 0 }}>
          <TrackList tracks={rows()} onPlay={onPlay} height="100%" />
        </div>
      </Show>
      <Show when={resource.error()}>
        {(e) => <p style={{ color: 'var(--error-border)' }}>{e().message}</p>}
      </Show>
    </div>
  );
};

export default LikedSongs;
