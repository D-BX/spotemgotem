// Minimal typed Web API client for Milestone 1. Attaches a valid bearer token
// and parses JSON. Full rate-limit / 429 / QUOTA_EXCEEDED handling arrives with
// the Milestone 3 API layer; here we just fail loudly on non-2xx.

import { getValidAccessToken } from '../auth/spotifyAuth';
import { API_BASE_URL } from '../auth/config';
import type { SpotifyUser } from './types';

async function apiGet<T>(path: string): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API GET ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export function getCurrentUser(): Promise<SpotifyUser> {
  return apiGet<SpotifyUser>('/me');
}
