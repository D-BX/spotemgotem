// PKCE helpers (RFC 7636) and CSRF state generation, using the Web Crypto API.

const VERIFIER_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    // Map each byte onto the unreserved character set.
    out += VERIFIER_CHARS[byte % VERIFIER_CHARS.length];
  }
  return out;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** High-entropy code verifier, 43-128 chars from the unreserved set. */
export function generateCodeVerifier(): string {
  return randomString(64);
}

/** S256 code challenge: base64url(SHA-256(verifier)), no padding. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/** Opaque value for CSRF protection, echoed back on the callback. */
export function randomState(): string {
  return randomString(32);
}
