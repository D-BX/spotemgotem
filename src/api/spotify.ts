// Typed Spotify Web API endpoint functions. These follow the 2026 Dev Mode
// rules: playlist/library entries wrap tracks under `item`, search is capped at
// 10 results per request, and removed fields are not requested. Pagination is
// done with limit/offset; unexpected response shapes fail loudly.

import { apiGet, apiPost } from './client';
import type {
  AlbumDetail,
  AlbumSummary,
  AlbumTrack,
  Paging,
  PlaylistDetail,
  PlaylistSummary,
  QueueResponse,
  SavedAlbum,
  SearchResults,
  SpotifyUser,
  Track,
  TrackEntry,
} from './types';

const PAGE = 50;
const TRACK_PAGE = 100;

// A hard ceiling on how many pages we'll walk for one list. Even a huge library
// (10k+ saved tracks) stays well under this; it exists only so a malformed
// response (e.g. a `next` that never clears, or a missing `total`) can't spin
// the loop forever — the real-world symptom that left Playlists/Liked stuck on
// "Loading…". We stop loudly rather than hang.
const MAX_PAGES = 400;

/**
 * Walk limit/offset pages until exhausted, collecting all items. An optional
 * `onBatch` fires with each page's items as it arrives, so callers can render
 * incrementally instead of blocking on the whole library — this is what keeps
 * large Playlists/Liked lists from sitting on "Loading…" while every page is
 * fetched serially.
 */
async function getAllPages<T>(
  path: string,
  query: Record<string, string>,
  pageSize: number,
  onBatch?: (items: T[]) => void,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (let pageNum = 0; ; pageNum++) {
    const page = await apiGet<Paging<T>>(path, {
      ...query,
      limit: String(pageSize),
      offset: String(offset),
    });
    const batch = page.items ?? [];
    items.push(...batch);
    if (batch.length > 0) onBatch?.(batch);
    offset += batch.length;
    if (!page.next || batch.length === 0) break;
    // Guard against a missing `total` (can't rely on offset >= total then).
    if (typeof page.total === 'number' && offset >= page.total) break;
    if (pageNum + 1 >= MAX_PAGES) {
      console.warn(
        `getAllPages(${path}) hit the ${MAX_PAGES}-page safety cap; ` +
          `stopping with ${items.length} items.`,
      );
      break;
    }
  }
  return items;
}

/**
 * Unwrap a track entry, failing loudly if the shape is off. Playlist items
 * (GET /playlists/{id}/items) nest the track under `item`; saved ("liked")
 * tracks (GET /me/tracks) use `track`. Accept whichever is present.
 */
function entryTrack(entry: TrackEntry): Track {
  const track = entry?.item ?? entry?.track;
  if (!track) {
    throw new Error(
      `Expected an 'item' or 'track' field on a track entry. Got keys: ` +
        `${entry ? Object.keys(entry).join(', ') : 'null'}`,
    );
  }
  return track;
}

export function getCurrentUser(): Promise<SpotifyUser> {
  return apiGet<SpotifyUser>('/me');
}

export function getMyPlaylists(): Promise<PlaylistSummary[]> {
  return getAllPages<PlaylistSummary>('/me/playlists', {}, PAGE);
}

export function getPlaylist(id: string): Promise<PlaylistDetail> {
  return apiGet<PlaylistDetail>(`/playlists/${id}`);
}

export async function getPlaylistTracks(id: string): Promise<Track[]> {
  // Feb-2026: /playlists/{id}/tracks was removed in favour of /items.
  const entries = await getAllPages<TrackEntry>(
    `/playlists/${id}/items`,
    {},
    TRACK_PAGE,
  );
  return entries.map(entryTrack);
}

export async function getSavedTracks(): Promise<Track[]> {
  const entries = await getAllPages<TrackEntry>('/me/tracks', {}, PAGE);
  return entries.map(entryTrack);
}

// --- Streaming variants ----------------------------------------------------
// These report each page as it arrives so a caller can show the first results
// immediately and grow the list, rather than waiting for the entire library.

/** Stream the user's playlists page-by-page; resolves when all pages are in. */
export async function streamMyPlaylists(
  onBatch: (playlists: PlaylistSummary[]) => void,
): Promise<void> {
  await getAllPages<PlaylistSummary>('/me/playlists', {}, PAGE, onBatch);
}

/** Stream the user's saved ("liked") tracks page-by-page. */
export async function streamSavedTracks(
  onBatch: (tracks: Track[]) => void,
): Promise<void> {
  await getAllPages<TrackEntry>('/me/tracks', {}, PAGE, (entries) =>
    onBatch(entries.map(entryTrack)),
  );
}

/** Stream a playlist's tracks page-by-page. */
export async function streamPlaylistTracks(
  id: string,
  onBatch: (tracks: Track[]) => void,
): Promise<void> {
  await getAllPages<TrackEntry>(`/playlists/${id}/items`, {}, TRACK_PAGE, (entries) =>
    onBatch(entries.map(entryTrack)),
  );
}

export async function getSavedAlbums(): Promise<AlbumSummary[]> {
  const saved = await getAllPages<SavedAlbum>('/me/albums', {}, PAGE);
  return saved.map((s) => s.album);
}

export async function getAlbumWithTracks(
  id: string,
): Promise<{ album: AlbumSummary; tracks: AlbumTrack[] }> {
  const detail = await apiGet<AlbumDetail>(`/albums/${id}`);
  const tracks = [...detail.tracks.items];
  // Pull any remaining pages beyond the first embedded page.
  if (detail.tracks.next) {
    const rest = await getAllPages<AlbumTrack>(
      `/albums/${id}/tracks`,
      {},
      TRACK_PAGE,
    );
    // The dedicated endpoint returns the full list; prefer it when present.
    return { album: detail, tracks: rest };
  }
  return { album: detail, tracks };
}

/** Search, capped at 10 results per type (Dev Mode limit). */
export function search(query: string): Promise<SearchResults> {
  return apiGet<SearchResults>('/search', {
    q: query,
    type: 'track,album,playlist',
    limit: '10',
  });
}

export function getQueue(): Promise<QueueResponse> {
  return apiGet<QueueResponse>('/me/player/queue');
}

export function addToQueue(uri: string, deviceId: string): Promise<void> {
  return apiPost('/me/player/queue', { query: { uri, device_id: deviceId } });
}
