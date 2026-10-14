// A single playlist: header (art, name, owner, count) plus a virtualized list of
// its tracks. Clicking a track starts the playlist context at that track so the
// rest of the list queues up behind it.

import { Show, createMemo, type Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { getPlaylist, getPlaylistTracks } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { playContext } from '../player/spotifyPlayer';
import { setError } from '../stores/auth';
import TrackList, { type TrackRow } from '../components/TrackList';
import type { PlaylistDetail, Track } from '../api/types';

interface PlaylistData {
  detail: PlaylistDetail;
  tracks: Track[];
}

const Playlist: Component = () => {
  const params = useParams<{ id: string }>();

  const resource = createCachedResource<PlaylistData>(
    () => (params.id ? `playlist:${params.id}` : undefined),
    async () => {
      const [detail, tracks] = await Promise.all([
        getPlaylist(params.id),
        getPlaylistTracks(params.id),
      ]);
      return { detail, tracks };
    },
  );

  const rows = createMemo<TrackRow[]>(() => resource.data()?.tracks ?? []);

  const onPlay = (track: TrackRow): void => {
    const uri = resource.data()?.detail.uri;
    if (!uri) return;
    void playContext(uri, track.uri).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <Show
      when={resource.data()}
      fallback={<div style={{ color: '#666' }}>Loading…</div>}
    >
      {(data) => (
        <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
          <header style={{ display: 'flex', gap: '1rem', 'align-items': 'flex-end', 'margin-bottom': '1rem' }}>
            <Show when={data().detail.images[0]?.url}>
              {(src) => <img src={src()} alt="" width={160} height={160} style={{ 'border-radius': '0.5rem', 'object-fit': 'cover' }} />}
            </Show>
            <div>
              <div style={{ color: '#9aa', 'font-size': '0.8rem' }}>Playlist</div>
              <h1 style={{ margin: '0.25rem 0' }}>{data().detail.name}</h1>
              <Show when={data().detail.description}>
                {(d) => <div style={{ color: '#9aa', 'font-size': '0.9rem' }}>{d()}</div>}
              </Show>
              <div style={{ color: '#888', 'font-size': '0.85rem', 'margin-top': '0.25rem' }}>
                {data().detail.owner.display_name ?? 'Unknown'} • {data().detail.tracks.total} tracks
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

export default Playlist;
