// Authorization Code with PKCE flow: login redirect, callback exchange, token
// refresh, and logout. No backend and no client secret.

import {
  AUTH_URL,
  REDIRECT_URI,
  SCOPES,
  SPOTIFY_CLIENT_ID,
  TOKEN_URL,
} from './config';
import { generateCodeChallenge, generateCodeVerifier, randomState } from './pkce';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  setAccessToken,
  setRefreshToken,
} from './tokenStore';

// Transient PKCE values survive the redirect in sessionStorage (same tab).
const VERIFIER_KEY = 'spotemgotem.pkce_verifier';
const STATE_KEY = 'spotemgotem.pkce_state';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

function applyTokenResponse(data: TokenResponse): void {
  setAccessToken(data.access_token, data.expires_in);
  // On refresh the server may omit refresh_token; the existing one stays valid.
  if (data.refresh_token) setRefreshToken(data.refresh_token);
}

/** Build the authorize URL and redirect the browser to Spotify's consent page. */
export async function beginLogin(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = randomState();

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  window.location.assign(`${AUTH_URL}?${params.toString()}`);
}

/**
 * Handle the /callback redirect: validate state, exchange the code for tokens,
 * then clean the URL back to '/'. Throws on any mismatch or error.
 */
export async function handleCallback(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  const cleanUrl = (): void =>
    window.history.replaceState({}, '', window.location.origin + '/');

  if (error) {
    cleanUrl();
    throw new Error(`Spotify authorization failed: ${error}`);
  }
  if (!code || !returnedState || !verifier || !expectedState) {
    cleanUrl();
    throw new Error('Incomplete authorization callback.');
  }
  if (returnedState !== expectedState) {
    cleanUrl();
    throw new Error('State mismatch on authorization callback.');
  }

  const data = await requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    }),
  );
  applyTokenResponse(data);
  cleanUrl();
}

/** Exchange the stored refresh token for a fresh access token. */
export async function refreshAccessToken(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available.');

  const data = await requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
    }),
  );
  applyTokenResponse(data);
}

/** Return a valid access token, refreshing first if it is missing or expired. */
export async function getValidAccessToken(): Promise<string> {
  if (isAccessTokenExpired()) await refreshAccessToken();
  const token = getAccessToken();
  if (!token) throw new Error('Unable to obtain an access token.');
  return token;
}

export function logout(): void {
  clearTokens();
}

export function hasStoredSession(): boolean {
  return getRefreshToken() !== null;
}

export function isCallbackUrl(): boolean {
  return window.location.pathname === '/callback';
}
