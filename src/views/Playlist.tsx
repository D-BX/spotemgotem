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
      fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}
    >
      {(data) => (
        <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
          <header style={{ display: 'flex', gap: 'var(--sp-5)', 'align-items': 'flex-end', 'margin-bottom': 'var(--sp-5)' }}>
            <Show when={data().detail.images[0]?.url}>
              {(src) => <img src={src()} alt="" width={160} height={160} style={{ 'border-radius': 'var(--radius-md)', 'object-fit': 'cover' }} />}
            </Show>
            <div>
              <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-sm)' }}>Playlist</div>
              <h1 style={{ margin: 'var(--sp-1) 0' }}>{data().detail.name}</h1>
              <Show when={data().detail.description}>
                {(d) => <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-md)' }}>{d()}</div>}
              </Show>
              <div style={{ color: 'var(--text-muted)', 'font-size': 'var(--fs-smd)', 'margin-top': 'var(--sp-1)' }}>
                {data().detail.owner.display_name ?? 'Unknown'} • {data().detail.items?.total ?? rows().length} tracks
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
