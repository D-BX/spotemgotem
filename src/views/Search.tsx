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
      <form onSubmit={onSubmit} style={{ 'margin-bottom': 'var(--sp-6)' }}>
        <input
          type="search"
          value={term()}
          onInput={(e) => setTerm(e.currentTarget.value)}
          placeholder="Songs, albums, playlists…"
          style={{
            width: '100%',
            'max-width': '28rem',
            padding: 'var(--sp-3) var(--sp-4)',
            'border-radius': 'var(--radius-lg)',
            border: '1px solid var(--border-input)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
          }}
        />
      </form>

      <Show when={results.loading()}>
        <div style={{ color: 'var(--text-disabled)' }}>Searching…</div>
      </Show>
      <Show when={results.error()}>
        {(e) => <p style={{ color: 'var(--error-border)' }}>{e().message}</p>}
      </Show>

      <Show when={results.data()}>
        {(res) => (
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: 'var(--sp-7)' }}>
            <Show when={res().tracks?.items.length}>
              <section>
                <h2 style={{ 'font-size': 'var(--fs-base)', color: 'var(--text-section)' }}>Tracks</h2>
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
                          gap: 'var(--sp-4)',
                          padding: 'var(--sp-2) var(--sp-3)',
                          cursor: 'pointer',
                          'border-bottom': '1px solid var(--border)',
                        }}
                      >
                        <Show when={t.album.images[0]?.url}>
                          {(src) => <img src={src()} alt="" width={36} height={36} style={{ 'border-radius': 'var(--radius-sm)' }} />}
                        </Show>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{t.name}</div>
                          <div style={{ color: 'var(--text-subtle)', 'font-size': 'var(--fs-sm)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
                            {t.artists.map((a) => a.name).join(', ')}
                          </div>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>{formatTime(t.duration_ms)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <Show when={res().albums?.items.length}>
              <section>
                <h2 style={{ 'font-size': 'var(--fs-base)', color: 'var(--text-section)' }}>Albums</h2>
                <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(9rem, 1fr))', gap: 'var(--sp-5)' }}>
                  <For each={res().albums?.items ?? []}>
                    {(a) => (
                      <A href={`/album/${a.id}`} style={{ 'text-decoration': 'none', color: 'var(--text)' }}>
                        <Show when={a.images[0]?.url}>
                          {(src) => <img src={src()} alt="" style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': 'var(--radius-sm)', 'object-fit': 'cover' }} />}
                        </Show>
                        <div style={{ 'font-size': 'var(--fs-smd)', 'margin-top': 'var(--sp-2)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{a.name}</div>
                      </A>
                    )}
                  </For>
                </div>
              </section>
            </Show>

            <Show when={res().playlists?.items.length}>
              <section>
                <h2 style={{ 'font-size': 'var(--fs-base)', color: 'var(--text-section)' }}>Playlists</h2>
                <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(9rem, 1fr))', gap: 'var(--sp-5)' }}>
                  <For each={res().playlists?.items ?? []}>
                    {(p) => (
                      <A href={`/playlist/${p.id}`} style={{ 'text-decoration': 'none', color: 'var(--text)' }}>
                        <Show when={p.images[0]?.url}>
                          {(src) => <img src={src()} alt="" style={{ width: '100%', 'aspect-ratio': '1', 'border-radius': 'var(--radius-sm)', 'object-fit': 'cover' }} />}
                        </Show>
                        <div style={{ 'font-size': 'var(--fs-smd)', 'margin-top': 'var(--sp-2)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{p.name}</div>
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
