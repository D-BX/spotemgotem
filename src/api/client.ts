// Low-level Web API client: attaches a valid bearer token, handles 429 rate
// limiting (respects Retry-After, surfaces QUOTA_EXCEEDED loudly instead of
// looping), and dedupes identical in-flight GET requests.

import { getValidAccessToken } from '../auth/spotifyAuth';
import { API_BASE_URL } from '../auth/config';

export interface SendOptions {
  query?: Record<string, string>;
  body?: unknown;
}

// Safety cap so transient rate limits can't spin forever.
const MAX_RATE_LIMIT_RETRIES = 3;

/** Thrown when Spotify reports the developer quota is exhausted. */
export class QuotaExceededError extends Error {
  constructor() {
    super(
      'Spotify quota exceeded for this app. Development Mode apps share a quota ' +
        'across the developer account. Try again later.',
    );
    this.name = 'QuotaExceededError';
  }
}

export class SpotifyApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'SpotifyApiError';
    this.status = status;
  }
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reasonFor429(res: Response): Promise<string | null> {
  try {
    const data = (await res.clone().json()) as { error?: { reason?: string } };
    return data.error?.reason ?? null;
  } catch {
    return null;
  }
}

/** Fetch with bearer auth and 429 handling. */
async function authedFetch(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<Response> {
  const token = await getValidAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    const reason = await reasonFor429(res);
    if (reason === 'QUOTA_EXCEEDED') throw new QuotaExceededError();
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new SpotifyApiError(429, 'Rate limited; retries exhausted.');
    }
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1') || 1;
    await delay(retryAfter * 1000);
    return authedFetch(url, init, attempt + 1);
  }
  return res;
}

async function parseOrThrow<T>(res: Response, method: string, path: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SpotifyApiError(res.status, `${method} ${path} failed (${res.status}): ${text}`);
  }
  // 204/empty responses (common for player mutations) have no JSON body.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Dedupe identical in-flight GETs so concurrent callers share one request.
const inFlight = new Map<string, Promise<unknown>>();

export function apiGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const url = buildUrl(path, query);
  const existing = inFlight.get(url) as Promise<T> | undefined;
  if (existing) return existing;

  const request = (async () => {
    const res = await authedFetch(url, { method: 'GET' });
    return parseOrThrow<T>(res, 'GET', path);
  })();

  inFlight.set(url, request);
  return request.finally(() => inFlight.delete(url));
}

export async function apiSend(
  method: 'PUT' | 'POST' | 'DELETE',
  path: string,
  options: SendOptions = {},
): Promise<void> {
  const hasBody = options.body !== undefined;
  const res = await authedFetch(buildUrl(path, options.query), {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });
  await parseOrThrow<void>(res, method, path);
}

export function apiPut(path: string, options?: SendOptions): Promise<void> {
  return apiSend('PUT', path, options);
}

export function apiPost(path: string, options?: SendOptions): Promise<void> {
  return apiSend('POST', path, options);
}
