// Subset of the Spotify Web API user object that this milestone actually uses.
// Only fields consumed by the UI are declared; no invented fields.

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
  product: string; // e.g. "premium" | "free"
}
