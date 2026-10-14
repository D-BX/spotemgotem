// Token persistence. The access token lives in memory only (never written to
// storage). The refresh token is persisted in localStorage so the session
// survives a browser restart. Refresh scheduling/logic lives in spotifyAuth.ts;
// this module is pure state.

const REFRESH_TOKEN_KEY = 'spotemgotem.refresh_token';

// Treat the access token as expired this many ms early to avoid races against
// the real expiry during a request.
export const EXPIRY_SKEW_MS = 60_000;

let accessToken: string | null = null;
let expiresAt = 0; // epoch ms

export function setAccessToken(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** True when there is no token or it is at/near its expiry. */
export function isAccessTokenExpired(): boolean {
  return accessToken === null || Date.now() >= expiresAt - EXPIRY_SKEW_MS;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  accessToken = null;
  expiresAt = 0;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
