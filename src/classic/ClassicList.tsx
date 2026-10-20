// The browser panel beneath the player: the authentic Winamp playlist-editor
// window, drawn on a canvas from the active skin's pledit.bmp (frame, corners,
// edges, scrollbar thumb) with the list text in the skin's pledit font/colours.
// It is the same drawing approach as ClassicFace, so the whole classic window
// reads as one skinned app rather than a modern widget bolted underneath.
//
// A thin tab row inside the interior switches between Queue / Playlists / Liked
// / Skins (and a Back control when drilled into a playlist); a couple of
// right-aligned text actions host Pop out (PiP) and Full UI. Rows only read data
// and call the existing control functions. Library pages stream their results in
// page-by-page, so the list appears on the first batch instead of blocking on
// the whole library — the fix for the old "stuck on Loading…" behaviour.
//
// Pointer handlers use direct `on:pointer*`/`on:wheel` listeners (not Solid's
// delegated events) to stay consistent with ClassicFace and robust under scaling.

import { createEffect, createSignal, onCleanup, onMount, type Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { playerState, setPlayerState } from '../player/playerStore';
import { playTrack, playContext } from '../player/spotifyPlayer';
import {
  getQueue,
  streamMyPlaylists,
  streamPlaylistTracks,
  streamSavedTracks,
} from '../api/spotify';
import { SpotifyApiError } from '../api/client';
import type { PlaylistSummary, Track } from '../api/types';
import {
  activeSkin,
  skinLibrary,
  setActiveSkin,
  loadSkinFromFile,
} from '../skins/skinStore';
import { getSkinBitmaps, type SheetBitmaps } from '../skins/skinBitmaps';
import { openPip, closePip, pipSupported, isPipOpen } from './pip';
import {
  drawPlaylistWindow,
  type PlaylistViewModel,
  type PlaylistHitRegions,
  type PlRowVM,
} from './draw';
import {
  PLAYLIST_WIDTH,
  PLAYLIST_HEIGHT,
  plVisibleRows,
  plScrollTrack,
  plScrollThumb,
  plRowAt,
  pointIn,
} from './geometry';
import { PLEDIT } from '../skins/sprites';

interface ListProps {
  scale: () => number;
  /** Dragging the playlist title bar reports incremental movement so the shell
   *  can reposition the whole window (same contract as ClassicFace). */
  onMoveBy?: (dx: number, dy: number) => void;
}

type Page = 'queue' | 'playlists' | 'liked' | 'skins';

const PAGES: { id: Page; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'liked', label: 'Liked' },
  { id: 'skins', label: 'Skins' },
];

const EMPTY: Record<Page, string> = {
  queue: 'Nothing queued.',
  playlists: 'No playlists found.',
  liked: 'No liked songs yet.',
  skins: 'No skins.',
};

function trackLabel(t: Track): string {
  return `${t.artists.map((a) => a.name).join(', ')} - ${t.name}`;
}

/** Run a playback action, surfacing any failure via playerState (ClassicApp
 *  renders it; the classic window has no other error channel for playback). */
function play(run: () => Promise<void>): void {
  setPlayerState('error', null);
  run().catch((e: unknown) =>
    setPlayerState('error', e instanceof Error ? e.message : String(e)),
  );
}

const ClassicList: Component<ListProps> = (props) => {
  const navigate = useNavigate();
  let canvas!: HTMLCanvasElement;
  let fileInput!: HTMLInputElement;

  // --- View + data state -----------------------------------------------------
  const [page, setPage] = createSignal<Page>('queue');
  const [selected, setSelected] = createSignal<PlaylistSummary | null>(null);
  const [firstRow, setFirstRow] = createSignal(0);

  const [queue, setQueue] = createSignal<Track[]>([]);
  const [playlists, setPlaylists] = createSignal<PlaylistSummary[]>([]);
  const [plTracks, setPlTracks] = createSignal<Track[]>([]);
  const [liked, setLiked] = createSignal<Track[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [bitmaps, setBitmaps] = createSignal<SheetBitmaps | null>(null);

  // Regions last painted (native px), for hit-testing clicks. Not reactive.
  let regions: PlaylistHitRegions = { tabs: [], actions: [] };
  // Action handlers parallel to the actions the last render drew.
  let actionRuns: (() => void)[] = [];

  const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
  const isCurrent = (t: Track): boolean => t.uri === playerState.track?.uri;

  // --- Loading (streamed, page-scoped, race-safe via an epoch) ---------------
  let epoch = 0;

  function load(): void {
    const myEpoch = ++epoch;
    const live = (): boolean => myEpoch === epoch;
    setFirstRow(0);
    setError(null);

    const p = page();
    const pl = selected();

    if (p === 'skins') {
      setLoading(false);
      return;
    }

    setLoading(true);
    const done = (): void => {
      if (live()) setLoading(false);
    };
    const fail = (e: unknown): void => {
      if (live()) {
        setError(msg(e));
        setLoading(false);
      }
    };

    if (p === 'queue') {
      setQueue([]);
      getQueue()
        .then((res) => {
          if (!live()) return;
          setQueue(res.currently_playing ? [res.currently_playing, ...res.queue] : res.queue);
          done();
        })
        .catch(fail);
    } else if (p === 'playlists' && pl) {
      setPlTracks([]);
      streamPlaylistTracks(pl.id, (batch) => {
        if (live()) setPlTracks((prev) => [...prev, ...batch]);
      })
        .then(done)
        .catch((e: unknown) => {
          // Spotify Dev Mode only exposes items for playlists you own or
          // collaborate on; others return 403 with no workaround. Say so plainly.
          if (e instanceof SpotifyApiError && e.status === 403) {
            if (live()) {
              setError('Spotify only allows opening playlists you own or collaborate on.');
              setLoading(false);
            }
            return;
          }
          fail(e);
        });
    } else if (p === 'playlists') {
      setPlaylists([]);
      streamMyPlaylists((batch) => {
        if (live()) setPlaylists((prev) => [...prev, ...batch]);
      })
        .then(done)
        .catch(fail);
    } else if (p === 'liked') {
      setLiked([]);
      streamSavedTracks((batch) => {
        if (live()) setLiked((prev) => [...prev, ...batch]);
      })
        .then(done)
        .catch(fail);
    }
  }

  // Re-load whenever the page or drilled-in playlist changes. The queue also
  // refreshes when the playing track changes (its contents move on).
  createEffect(() => {
    void page();
    void selected();
    if (page() === 'queue') void playerState.track?.uri;
    load();
  });

  function openPage(p: Page): void {
    setSelected(null);
    setPage(p);
  }

  // --- Skin bitmaps ----------------------------------------------------------
  createEffect(() => {
    const skin = activeSkin();
    void getSkinBitmaps(skin).then(setBitmaps);
  });

  // --- View model ------------------------------------------------------------
  function buildRows(): PlRowVM[] {
    const p = page();
    if (p === 'queue')
      return queue().map((t, i) => ({ text: `${i + 1}. ${trackLabel(t)}`, current: isCurrent(t) }));
    if (p === 'liked')
      return liked().map((t, i) => ({ text: `${i + 1}. ${trackLabel(t)}`, current: isCurrent(t) }));
    if (p === 'playlists') {
      if (selected())
        return plTracks().map((t, i) => ({ text: `${i + 1}. ${trackLabel(t)}`, current: isCurrent(t) }));
      return playlists().map((pl) => {
        const n = pl.items?.total;
        return { text: typeof n === 'number' ? `${pl.name}  (${n})` : pl.name, current: false };
      });
    }
    // skins
    const lib = skinLibrary();
    const active = activeSkin().id;
    const rows: PlRowVM[] = lib.map((m) => ({
      text: `${m.id === active ? '● ' : '   '}${m.name}`,
      current: m.id === active,
    }));
    rows.push({ text: '+ Import .wsz skin…', current: false });
    return rows;
  }

  function currentNotice(rowCount: number): string | null {
    if (page() === 'skins') return null;
    if (error()) return error();
    if (loading() && rowCount === 0) return 'Loading…';
    if (rowCount === 0) return EMPTY[page()];
    return null;
  }

  // --- Click dispatch --------------------------------------------------------
  function onRowClick(idx: number): void {
    const p = page();
    if (p === 'queue') {
      const t = queue()[idx];
      if (t) play(() => playTrack(t.uri));
    } else if (p === 'liked') {
      const t = liked()[idx];
      if (t) play(() => playTrack(t.uri));
    } else if (p === 'playlists') {
      const pl = selected();
      if (pl) {
        const t = plTracks()[idx];
        if (t) play(() => playContext(pl.uri, t.uri));
      } else {
        const chosen = playlists()[idx];
        if (chosen) setSelected(chosen);
      }
    } else if (p === 'skins') {
      const lib = skinLibrary();
      if (idx < lib.length) void setActiveSkin(lib[idx]!.id);
      else fileInput.click(); // the trailing "Import" row
    }
  }

  function onTabClick(i: number): void {
    if (selected()) {
      setSelected(null); // the lone "Back" tab
      return;
    }
    const target = PAGES[i];
    if (target) openPage(target.id);
  }

  // --- Rendering -------------------------------------------------------------
  function render(): void {
    const bmps = bitmaps();
    if (!bmps) return;
    const scale = props.scale();
    const w = PLAYLIST_WIDTH;
    const h = PLAYLIST_HEIGHT;

    // Backing store = native × scale, drawn 1:1 with CSS pixels; a scale
    // transform keeps text crisp while sprites stay nearest-neighbour sharp.
    if (canvas.width !== w * scale || canvas.height !== h * scale) {
      canvas.width = w * scale;
      canvas.height = h * scale;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const rows = buildRows();
    const sel = selected();

    const tabs = sel
      ? [{ label: '‹ Back', active: false }]
      : PAGES.map((pg) => ({ label: pg.label, active: page() === pg.id }));

    const actions: { label: string }[] = [];
    actionRuns = [];
    actions.push({ label: 'Full UI' });
    actionRuns.push(() => navigate('/modern'));
    if (pipSupported()) {
      actions.push({ label: isPipOpen() ? 'Un-pop' : 'Pop out' });
      actionRuns.push(() => (isPipOpen() ? closePip() : void openPip()));
    }

    const vm: PlaylistViewModel = {
      active: true,
      // Only show a title when drilled into a playlist (its name is useful info).
      // The top-level page name is dropped — it just echoed the active tab.
      title: sel ? sel.name : '',
      tabs,
      actions,
      rows,
      firstRow: firstRow(),
      notice: currentNotice(rows.length),
    };

    regions = drawPlaylistWindow(ctx, bmps, activeSkin(), vm, w, h);
  }

  createEffect(() => {
    // Track every input the view depends on, then paint.
    void bitmaps();
    void activeSkin();
    void page();
    void selected();
    void firstRow();
    void queue();
    void playlists();
    void plTracks();
    void liked();
    void loading();
    void error();
    void skinLibrary();
    void playerState.track?.uri;
    void props.scale();
    void isPipOpen();
    render();
  });

  onMount(render);

  // --- Pointer / wheel interaction ------------------------------------------
  function toNative(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: ((e.clientX - rect.left) * sx) / props.scale(),
      y: ((e.clientY - rect.top) * sy) / props.scale(),
    };
  }

  function maxScroll(): number {
    return Math.max(0, buildRows().length - plVisibleRows());
  }

  let dragging: 'window' | 'thumb' | null = null;
  let lastClient = { x: 0, y: 0 };

  function scrollToPointer(nativeY: number): void {
    const track = plScrollTrack();
    const travel = Math.max(1, track.h - PLEDIT.SCROLL_H);
    const frac = (nativeY - track.y - PLEDIT.SCROLL_H / 2) / travel;
    setFirstRow(Math.round(Math.min(1, Math.max(0, frac)) * maxScroll()));
  }

  function onPointerDown(e: PointerEvent): void {
    const { x, y } = toNative(e);
    canvas.setPointerCapture(e.pointerId);

    // Title bar: drag the whole window (if the host allows it).
    if (y < PLEDIT.TITLE_H) {
      if (!props.onMoveBy) return;
      dragging = 'window';
      // Screen coords (see ClassicFace): stable when the native window moves.
      lastClient = { x: e.screenX, y: e.screenY };
      return;
    }

    // Tabs / actions (text buttons the last render reported).
    for (let i = 0; i < regions.tabs.length; i++) {
      if (pointIn(regions.tabs[i]!, x, y)) {
        onTabClick(i);
        return;
      }
    }
    for (let i = 0; i < regions.actions.length; i++) {
      if (pointIn(regions.actions[i]!, x, y)) {
        actionRuns[i]?.();
        return;
      }
    }

    // Scrollbar.
    const max = maxScroll();
    if (max > 0) {
      const track = plScrollTrack();
      const thumb = plScrollThumb(firstRow(), max);
      if (pointIn(thumb, x, y)) {
        dragging = 'thumb';
        return;
      }
      if (pointIn(track, x, y)) {
        scrollToPointer(y);
        dragging = 'thumb';
        return;
      }
    }

    // List rows.
    const idx = plRowAt(y, firstRow());
    if (idx >= 0 && idx < buildRows().length) onRowClick(idx);
  }

  function onPointerMove(e: PointerEvent): void {
    if (dragging === 'window') {
      props.onMoveBy?.(e.screenX - lastClient.x, e.screenY - lastClient.y);
      lastClient = { x: e.screenX, y: e.screenY };
    } else if (dragging === 'thumb') {
      scrollToPointer(toNative(e).y);
    }
  }

  function onPointerUp(e: PointerEvent): void {
    canvas.releasePointerCapture(e.pointerId);
    dragging = null;
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const step = e.deltaY > 0 ? 3 : -3;
    setFirstRow((r) => Math.min(maxScroll(), Math.max(0, r + step)));
  }

  onCleanup(() => {
    // nothing persistent to tear down; canvas listeners die with the node.
  });

  function onPickFile(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void loadSkinFromFile(file);
  }

  return (
    <>
      <canvas
        ref={canvas}
        style={{
          width: `${PLAYLIST_WIDTH * props.scale()}px`,
          height: `${PLAYLIST_HEIGHT * props.scale()}px`,
          display: 'block',
          cursor: 'default',
          'touch-action': 'none',
        }}
        on:pointerdown={(e) => onPointerDown(e as PointerEvent)}
        on:pointermove={(e) => onPointerMove(e as PointerEvent)}
        on:pointerup={(e) => onPointerUp(e as PointerEvent)}
        on:wheel={(e) => onWheel(e as WheelEvent)}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".wsz,application/zip"
        onChange={onPickFile}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default ClassicList;
