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

/** Walk limit/offset pages until exhausted, collecting all items. */
async function getAllPages<T>(
  path: string,
  query: Record<string, string>,
  pageSize: number,
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await apiGet<Paging<T>>(path, {
      ...query,
      limit: String(pageSize),
      offset: String(offset),
    });
    items.push(...page.items);
    offset += page.items.length;
    if (!page.next || page.items.length === 0 || offset >= page.total) break;
  }
  return items;
}

/** Unwrap a 2026 `item`-wrapped track entry, failing loudly if the shape is off. */
function entryTrack(entry: TrackEntry): Track {
  if (!entry || !entry.item) {
    throw new Error(
      `Expected an 'item' field on a track entry (2026 shape). Got keys: ` +
        `${entry ? Object.keys(entry).join(', ') : 'null'}`,
    );
  }
  return entry.item;
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
  const entries = await getAllPages<TrackEntry>(
    `/playlists/${id}/tracks`,
    {},
    TRACK_PAGE,
  );
  return entries.map(entryTrack);
}

export async function getSavedTracks(): Promise<Track[]> {
  const entries = await getAllPages<TrackEntry>('/me/tracks', {}, PAGE);
  return entries.map(entryTrack);
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
