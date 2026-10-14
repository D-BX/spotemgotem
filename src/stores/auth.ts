// Reactive auth state shared by the views. The auth flow writes here; the UI
// reads from here.

import { createSignal } from 'solid-js';
import type { SpotifyUser } from '../api/types';

export type AuthStatus = 'loading' | 'anonymous' | 'authed';

const [status, setStatus] = createSignal<AuthStatus>('loading');
const [profile, setProfile] = createSignal<SpotifyUser | null>(null);
const [error, setError] = createSignal<string | null>(null);

export { status, setStatus, profile, setProfile, error, setError };
