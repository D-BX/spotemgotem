// The player's current queue: what's playing now and what's next. The queue is
// volatile, so this view offers a manual refresh rather than relying only on the
// cached snapshot.

import { For, Show, type Component } from 'solid-js';
import { getQueue } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { formatTime } from '../lib/format';
import type { Track } from '../api/types';

const TrackRow: Component<{ track: Track; index?: number }> = (props) => (
  <div
    style={{
      display: 'flex',
      'align-items': 'center',
      gap: 'var(--sp-4)',
      padding: 'var(--sp-2) var(--sp-3)',
      'border-bottom': '1px solid var(--border)',
    }}
  >
    <Show when={props.index !== undefined}>
      <span style={{ width: '1.5rem', color: 'var(--text-muted)', 'text-align': 'right' }}>{(props.index ?? 0) + 1}</span>
    </Show>
    <Show when={props.track.album.images[0]?.url}>
      {(src) => <img src={src()} alt="" width={36} height={36} style={{ 'border-radius': 'var(--radius-sm)' }} />}
    </Show>
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <div style={{ 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{props.track.name}</div>
      <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-sm)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
        {props.track.artists.map((a) => a.name).join(', ')}
      </div>
    </div>
    <span style={{ color: 'var(--text-muted)' }}>{formatTime(props.track.duration_ms)}</span>
  </div>
);

const Queue: Component = () => {
  const resource = createCachedResource(() => 'me:queue', getQueue);

  return (
    <div>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
        <h1 style={{ 'margin-top': 0 }}>Queue</h1>
        <button type="button" onClick={() => resource.refetch()} disabled={resource.loading()}>
          {resource.loading() ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <Show when={resource.error()}>
        {(e) => <p style={{ color: 'var(--error-border)' }}>{e().message}</p>}
      </Show>

      <Show when={resource.data()} fallback={<div style={{ color: 'var(--text-disabled)' }}>Loading…</div>}>
        {(data) => (
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--sp-6)' }}>
            <section>
              <h2 style={{ 'font-size': 'var(--fs-md)', color: 'var(--text-section)' }}>Now Playing</h2>
              <Show when={data().currently_playing} fallback={<div style={{ color: 'var(--text-disabled)' }}>Nothing playing.</div>}>
                {(t) => <TrackRow track={t()} />}
              </Show>
            </section>
            <section>
              <h2 style={{ 'font-size': 'var(--fs-md)', color: 'var(--text-section)' }}>Next Up</h2>
              <Show when={data().queue.length > 0} fallback={<div style={{ color: 'var(--text-disabled)' }}>Queue is empty.</div>}>
                <For each={data().queue}>{(t, i) => <TrackRow track={t} index={i()} />}</For>
              </Show>
            </section>
          </div>
        )}
      </Show>
    </div>
  );
};

export default Queue;
