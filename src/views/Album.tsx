// A single album: header (art, name, artists, track count) plus its track list.
// Album track objects are simplified (no nested album), but they still carry the
// fields TrackList needs. Clicking a track starts the album context there.

import { Show, createMemo, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { getAlbumWithTracks } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { playContext } from '../player/spotifyPlayer';
import { setError } from '../stores/auth';
import TrackList, { type TrackRow } from '../components/TrackList';
import type { AlbumSummary, AlbumTrack } from '../api/types';

interface AlbumData {
  album: AlbumSummary;
  tracks: AlbumTrack[];
}

const Album: Component = () => {
  const params = useParams<{ id: string }>();

  const resource = createCachedResource<AlbumData>(
    () => (params.id ? `album:${params.id}` : undefined),
    () => getAlbumWithTracks(params.id),
  );

  const rows = createMemo<TrackRow[]>(() => resource.data()?.tracks ?? []);

  const onPlay = (track: TrackRow): void => {
    const uri = resource.data()?.album.uri;
    if (!uri) return;
    void playContext(uri, track.uri).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <Show
      when={resource.data()}
      fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}
    >
      {(data) => (
        <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
          <header style={{ display: 'flex', gap: 'var(--sp-5)', 'align-items': 'flex-end', 'margin-bottom': 'var(--sp-5)' }}>
            <Show when={data().album.images[0]?.url}>
              {(src) => <img src={src()} alt="" width={160} height={160} style={{ 'border-radius': 'var(--radius-md)', 'object-fit': 'cover' }} />}
            </Show>
            <div>
              <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-sm)' }}>Album</div>
              <h1 style={{ margin: 'var(--sp-1) 0' }}>{data().album.name}</h1>
              <div style={{ color: 'var(--text-muted)', 'font-size': 'var(--fs-smd)' }}>
                {data().album.artists.map((a) => a.name).join(', ')} • {data().album.total_tracks} tracks
              </div>
            </div>
          </header>
          <div style={{ flex: 1, 'min-height': 0 }}>
            <TrackList tracks={rows()} onPlay={onPlay} height="100%" />
          </div>
        </div>
      )}
    </Show>
  );
};

export default Album;
