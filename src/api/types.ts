// Subsets of Spotify Web API objects that this app actually uses. Fields removed
// for Dev Mode apps in 2026 (popularity, external_ids, audio features, etc.) are
// intentionally absent. Per the 2026 rules, playlist/library track entries wrap
// the track under `item` (not `track`).

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email: string;
  images: SpotifyImage[];
  product: string;
}

export interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
  limit: number;
  offset: number;
}

export interface SimpleArtist {
  id: string;
  name: string;
  uri: string;
}

export interface AlbumRef {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
}

export interface Track {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: SimpleArtist[];
  album: AlbumRef;
}

/** A playlist/library track entry. 2026 wraps the track under `item`. */
export interface TrackEntry {
  added_at: string | null;
  item: Track;
}

export interface PlaylistSummary {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[];
  owner: { display_name: string | null };
  tracks: { total: number };
}

export interface PlaylistDetail extends PlaylistSummary {
  description: string | null;
}

export interface AlbumSummary {
  id: string;
  uri: string;
  name: string;
  images: SpotifyImage[];
  artists: SimpleArtist[];
  total_tracks: number;
}

/** Album tracks are simplified (no nested album); we carry the parent album. */
export interface AlbumTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: SimpleArtist[];
}

export interface AlbumDetail extends AlbumSummary {
  tracks: Paging<AlbumTrack>;
}

export interface SavedAlbum {
  added_at: string | null;
  album: AlbumSummary;
}

export interface SearchResults {
  tracks?: Paging<Track>;
  albums?: Paging<AlbumSummary>;
  playlists?: Paging<PlaylistSummary>;
}

export interface QueueResponse {
  currently_playing: Track | null;
  queue: Track[];
}
