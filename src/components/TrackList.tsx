// Virtualized track list. Only the visible rows are rendered, so liked-songs
// lists of thousands stay smooth. Clicking a row plays it.

import { For, Show, type Component } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { formatTime } from '../lib/format';

export interface TrackRow {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
}

const ROW_HEIGHT = 48;

const TrackList: Component<{
  tracks: TrackRow[];
  onPlay: (track: TrackRow, index: number) => void;
  height: string;
}> = (props) => {
  let scrollParent: HTMLDivElement | undefined;

  const virtualizer = createVirtualizer({
    get count() {
      return props.tracks.length;
    },
    getScrollElement: () => scrollParent ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div ref={scrollParent} style={{ height: props.height, overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(row) => {
            const track = props.tracks[row.index];
            return (
              <Show when={track}>
                {(t) => (
                  <div
                    role="button"
                    tabindex={0}
                    onClick={() => props.onPlay(t(), row.index)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${row.size}px`,
                      transform: `translateY(${row.start}px)`,
                      display: 'flex',
                      'align-items': 'center',
                      gap: '0.75rem',
                      padding: '0 0.75rem',
                      cursor: 'pointer',
                      'box-sizing': 'border-box',
                      'border-bottom': '1px solid #1e1e1e',
                    }}
                  >
                    <span style={{ width: '2rem', color: '#888', 'text-align': 'right' }}>
                      {row.index + 1}
                    </span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ 'white-space': 'nowrap', 'text-overflow': 'ellipsis', overflow: 'hidden' }}>
                        {t().name}
                      </div>
                      <div
                        style={{
                          color: '#9aa',
                          'font-size': '0.8rem',
                          'white-space': 'nowrap',
                          'text-overflow': 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {t().artists.map((a) => a.name).join(', ')}
                      </div>
                    </div>
                    <span style={{ color: '#888' }}>{formatTime(t().duration_ms)}</span>
                  </div>
                )}
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
};

export default TrackList;
