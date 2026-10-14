// Minimal typed Web API client. Attaches a valid bearer token and parses JSON.
// Full rate-limit / 429 / QUOTA_EXCEEDED handling arrives with the Milestone 3
// API layer; here we just fail loudly on non-2xx.

import { getValidAccessToken } from '../auth/spotifyAuth';
import { API_BASE_URL } from '../auth/config';
import type { SpotifyUser } from './types';

interface SendOptions {
  query?: Record<string, string>;
  body?: unknown;
}

function buildUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(buildUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API GET ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Send a mutating request (PUT/POST). Many player endpoints return 204 with an
 * empty body, so this resolves to void and does not parse a response.
 */
async function apiSend(
  method: 'PUT' | 'POST',
  path: string,
  options: SendOptions = {},
): Promise<void> {
  const token = await getValidAccessToken();
  const hasBody = options.body !== undefined;
  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API ${method} ${path} failed (${res.status}): ${text}`);
  }
}

export function apiPut(path: string, options?: SendOptions): Promise<void> {
  return apiSend('PUT', path, options);
}

export function getCurrentUser(): Promise<SpotifyUser> {
  return apiGet<SpotifyUser>('/me');
}
