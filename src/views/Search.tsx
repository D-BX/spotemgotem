// Search across tracks, albums, and playlists. Dev Mode caps results at 10 per
// type, so results are small and don't need virtualization. The query is held in
// a signal; submitting it keys the cached resource (results are cached per query).

import { For, Show, createSignal, type Component } from 'solid-js';
import { A } from '@solidjs/router';
import { search } from '../api/spotify';
import { createCachedResource } from '../cache/resource';
import { playTrack } from '../player/spotifyPlayer';
import { formatTime } from '../lib/format';
import { setError } from '../stores/auth';
import type { SearchResults } from '../api/types';

const Search: Component = () => {
  const [term, setTerm] = createSignal('');
  const [query, setQuery] = createSignal('');

  const results = createCachedResource<SearchResults>(
    () => (query() ? `search:${query()}` : undefined),
    () => search(query()),
  );

  const onSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    setQuery(term().trim());
  };

  const onPlay = (uri: string): void => {
    void playTrack(uri).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <div>
      <h1 style={{ 'margin-top': 0 }}>Search</h1>
      <form onSubmit={onSubmit} style={{ 'margin-bottom': '1.5rem' }}>
        <input
          type="search"
          value={term()}
          onInput={(e) => setTerm(e.currentTarget.value)}
          placeholder="Songs, albums, playlists…"
          style={{
            width: '100%',
            'max-width': '28rem',
            padding: '0.6rem 0.8rem',
            'border-radius': '2rem',
            border: '1px solid #333',
            background: '#121212',
            color: '#eee',
          }}
        />
      </form>

      <Show when={results.loading()}>
        <div style={{ color: '#666' }}>Searching…</div>
      </Show>
      <Show when={results.error()}>
        {(e) => <p style={{ color: '#c0392b' }}>{e().message}</p>}
      </Show>

      <Show when={results.data()}>
        {(res) => (
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2rem' }}>
            <Show when={res().tracks?.items.length}>
              <section>
                <h2 style={{ 'font-size': '1rem', color: '#bbb' }}>Tracks</h2>
                <div style={{ display: 'flex', 'flex-direction': 'column' }}>
                  <For each={res().tracks?.items ?? []}>
                    {(t) => (
                      <div
                        role="button"
                        tabindex={0}
                        onClick={() => onPlay(t.uri)}
                        style={{
                          display: 'flex',
                          'align-items': 'center',
                          gap: '0.75rem',
                          padding: '0.4rem 0.5rem',
                          cursor: 'pointer',
                          'border-bottom': '1px solid #1e1e1e',
                        }}
                      >
                        <Show when={t.album.images[0]?.url}>
                          {(src) => <img src={src()} alt="" width={36} height={36} style={{ 'border-radius': '0.25rem' }} />}
                        </Show>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{t.name}</div>
                          <div style={{ color: '#9aa', 'font-size': '0.8rem', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
                            {t.artists.map((a) => a.name).join(', ')}
                          </div>
                        </div>
                        <span style={{ color: '#888' }}>{formatTime(t.duration_ms)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <Show when={res().albums?.items.length}>
              <section>
                <h2 style={{ 'font-size': '1rem', color: '#bbb' }}>Albums</h2>
                <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '1rem' }}>
                  <For each={res().albums?.items ?? []}>
                    {(a) => (
                      <A href={`/album/${a.id}`} style={{ 'text-decoration': 'none', color: '#eee' }}>
                        <Show when={a.images[0]?.url}>
                          {(src) => <img src={src()} alt="" style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': '0.25rem', 'object-fit': 'cover' }} />}
                        </Show>
                        <div style={{ 'font-size': '0.85rem', 'margin-top': '0.35rem', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{a.name}</div>
                      </A>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <Show when={res().playlists?.items.length}>
              <section>
                <h2 style={{ 'font-size': '1rem', color: '#bbb' }}>Playlists</h2>
                <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '1rem' }}>
                  <For each={res().playlists?.items ?? []}>
                    {(p) => (
                      <A href={`/playlist/${p.id}`} style={{ 'text-decoration': 'none', color: '#eee' }}>
                        <Show when={p.images[0]?.url}>
                          {(src) => <img src={src()} alt="" style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': '0.25rem', 'object-fit': 'cover' }} />}
                        </Show>
                        <div style={{ 'font-size': '0.85rem', 'margin-top': '0.35rem', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{p.name}</div>
                      </A>
                    )}
                  </For>
                </div>
              </section>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};

export default Search;
