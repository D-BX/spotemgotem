// Web Playback SDK wrapper: load the SDK script, create and connect the player,
// transfer playback to our device, and expose control functions. All playback
// state flows into the shared playerStore. SDK-native methods are used where
// available; shuffle/repeat/start-by-URI go through the Web API.

import { getValidAccessToken } from '../auth/spotifyAuth';
import { apiPut, SpotifyApiError } from '../api/client';
import {
  INITIAL_PLAYER_STATE,
  playerState,
  setPlayerState,
  type RepeatMode,
} from './playerStore';
import {
  setMediaPlaybackState,
  setupMediaSessionHandlers,
  updateMediaMetadata,
} from './mediaSession';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'spotemgotem';
const TICK_MS = 500;

let player: Spotify.Player | null = null;
let ticker: ReturnType<typeof setInterval> | undefined;
let sdkLoad: Promise<void> | null = null;

// Set when playback can't work at all (no Widevine/EME). We keep the reason so a
// later "play" click reports the real cause instead of "Player is not ready yet".
let unavailableReason: string | null = null;

/**
 * The Spotify Web Playback SDK decrypts audio through EME/Widevine. If the key
 * system isn't available (stock Electron with no CDM, or the castlabs CDM failed
 * to install) the SDK throws an uncaught EMEError and never becomes ready. We
 * probe first so we can show a clear message instead of a mysterious failure.
 */
async function assertWidevine(): Promise<void> {
  const nav = navigator as Navigator & {
    requestMediaKeySystemAccess?: Navigator['requestMediaKeySystemAccess'];
  };
  const probe = nav.requestMediaKeySystemAccess?.bind(nav);
  if (!probe) {
    throw new Error('This runtime has no EME support, so Spotify audio cannot play.');
  }
  try {
    await probe('com.widevine.alpha', [
      {
        initDataTypes: ['cenc'],
        audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }],
      },
    ]);
  } catch {
    throw new Error(
      'Widevine DRM is unavailable, so Spotify audio cannot play. In the desktop ' +
        'app the Widevine CDM failed to install — check your network and relaunch ' +
        '(it often installs in the background and works on the next start).',
    );
  }
}

/** Inject the SDK script once and resolve when the global is ready. */
function loadSdk(): Promise<void> {
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<void>((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    document.body.appendChild(script);
  });
  return sdkLoad;
}

function setError(prefix: string, message: string): void {
  setPlayerState('error', `${prefix}: ${message}`);
}

function onStateChanged(state: Spotify.PlaybackState | null): void {
  if (!state) {
    // Playback moved to another device / our device lost the state.
    setPlayerState('isActive', false);
    setMediaPlaybackState(true);
    return;
  }
  const current = state.track_window.current_track;
  const track = {
    uri: current.uri,
    name: current.name,
    artists: current.artists.map((a) => a.name).join(', '),
    album: current.album.name,
    image: current.album.images[0]?.url ?? null,
  };
  setPlayerState({
    isActive: true,
    paused: state.paused,
    positionMs: state.position,
    durationMs: state.duration,
    shuffle: state.shuffle,
    repeatMode: state.repeat_mode as RepeatMode,
    track,
  });
  updateMediaMetadata(track);
  setMediaPlaybackState(state.paused);
}

function startTicker(): void {
  if (ticker) return;
  ticker = setInterval(() => {
    if (playerState.isActive && !playerState.paused && playerState.durationMs > 0) {
      setPlayerState('positionMs', (p) =>
        Math.min(p + TICK_MS, playerState.durationMs),
      );
    }
  }, TICK_MS);
}

function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = undefined;
  }
}

async function transferPlayback(deviceId: string): Promise<void> {
  // play: false — move control here without force-starting audio.
  await apiPut('/me/player', { body: { device_ids: [deviceId], play: false } });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Load, create, wire, and connect the player. Safe to call multiple times. */
export async function initializePlayer(): Promise<void> {
  if (player) return;

  // Fail clearly and early if DRM is missing, rather than letting the SDK throw
  // an uncaught EMEError and leave the device perpetually "not ready".
  try {
    await assertWidevine();
    unavailableReason = null;
  } catch (e) {
    unavailableReason = e instanceof Error ? e.message : String(e);
    setPlayerState('error', unavailableReason);
    return;
  }

  await loadSdk();

  player = new window.Spotify.Player({
    name: PLAYER_NAME,
    getOAuthToken: (cb) => {
      getValidAccessToken()
        .then(cb)
        .catch((e: unknown) =>
          setError('Token', e instanceof Error ? e.message : String(e)),
        );
    },
    volume: playerState.volume,
  });

  player.addListener('ready', ({ device_id }) => {
    setPlayerState({ deviceId: device_id, isReady: true, error: null });
    void transferPlayback(device_id).catch((e: unknown) =>
      setError('Transfer', e instanceof Error ? e.message : String(e)),
    );
  });
  player.addListener('not_ready', () => setPlayerState('isReady', false));
  player.addListener('player_state_changed', onStateChanged);
  player.addListener('initialization_error', ({ message }) =>
    setError('Initialization', message),
  );
  player.addListener('authentication_error', ({ message }) =>
    setError('Authentication (reconnect to grant playback scopes)', message),
  );
  player.addListener('account_error', ({ message }) =>
    setError('Account (Spotify Premium required)', message),
  );
  player.addListener('playback_error', ({ message }) =>
    setError('Playback', message),
  );

  setupMediaSessionHandlers({
    play: () => void togglePlay(),
    pause: () => void togglePlay(),
    previousTrack: () => void previousTrack(),
    nextTrack: () => void nextTrack(),
    seekTo: (ms) => void seek(ms),
  });

  startTicker();
  await player.connect();
}

export function disconnectPlayer(): void {
  stopTicker();
  if (player) {
    player.disconnect();
    player = null;
  }
  sdkLoad = null;
  unavailableReason = null;
  updateMediaMetadata(null);
  setPlayerState({ ...INITIAL_PLAYER_STATE });
}

// --- SDK-native controls -------------------------------------------------

export async function togglePlay(): Promise<void> {
  if (player) await player.togglePlay();
}

export async function nextTrack(): Promise<void> {
  if (player) await player.nextTrack();
}

export async function previousTrack(): Promise<void> {
  if (player) await player.previousTrack();
}

export async function seek(positionMs: number): Promise<void> {
  if (!player) return;
  await player.seek(positionMs);
  setPlayerState('positionMs', positionMs);
}

export async function setVolume(volume: number): Promise<void> {
  const clamped = Math.min(1, Math.max(0, volume));
  setPlayerState('volume', clamped);
  if (player) await player.setVolume(clamped);
}

// --- Web API controls (not exposed by the SDK) ---------------------------

export async function toggleShuffle(): Promise<void> {
  if (!playerState.deviceId) return;
  const next = !playerState.shuffle;
  await apiPut('/me/player/shuffle', {
    query: { state: String(next), device_id: playerState.deviceId },
  });
  setPlayerState('shuffle', next);
}

const REPEAT_STATES = ['off', 'context', 'track'] as const;

export async function cycleRepeat(): Promise<void> {
  if (!playerState.deviceId) return;
  const next = ((playerState.repeatMode + 1) % 3) as RepeatMode;
  await apiPut('/me/player/repeat', {
    query: { state: REPEAT_STATES[next], device_id: playerState.deviceId },
  });
  setPlayerState('repeatMode', next);
}

/**
 * Convert a Spotify URI or open.spotify.com link into a canonical URI.
 * Throws on anything unrecognized rather than guessing.
 */
export function toSpotifyUri(input: string): string {
  const value = input.trim();
  if (/^spotify:(track|album|playlist|artist):[A-Za-z0-9]+$/.test(value)) {
    return value;
  }
  const match = value.match(
    /open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/,
  );
  if (match) return `spotify:${match[1]}:${match[2]}`;
  throw new Error('Unrecognized Spotify URI or link.');
}

/**
 * Start playback on our Web SDK device. Spotify Connect drops an idle device from
 * its list, after which `/me/player/play` returns 404 "Device not found". When
 * that happens we re-transfer playback to our device and retry the start — but the
 * device needs a moment to re-register with Connect after a transfer, so we settle
 * briefly and retry a couple of times before giving up. This is what made clicks
 * feel unreliable (the old immediate retry often 404'd again, so only a *second*
 * user click, once the device was live, would start audio).
 */
async function startPlayback(body: Record<string, unknown>): Promise<void> {
  const deviceId = playerState.deviceId;
  if (!deviceId) throw new Error(unavailableReason ?? 'Player is not ready yet.');
  try {
    await apiPut('/me/player/play', { query: { device_id: deviceId }, body });
  } catch (e) {
    if (!(e instanceof SpotifyApiError) || e.status !== 404) throw e;
    await transferPlayback(deviceId);
    for (let attempt = 0; attempt < 3; attempt++) {
      await delay(400);
      try {
        await apiPut('/me/player/play', { query: { device_id: deviceId }, body });
        return;
      } catch (retryErr) {
        const deviceGone =
          retryErr instanceof SpotifyApiError && retryErr.status === 404;
        if (!deviceGone || attempt === 2) throw retryErr;
      }
    }
  }
}

/** Start playback of a track/album/playlist/artist URI on our device. */
export async function playUri(input: string): Promise<void> {
  const uri = toSpotifyUri(input);
  const type = uri.split(':')[1];
  const body = type === 'track' ? { uris: [uri] } : { context_uri: uri };
  await startPlayback(body);
}

/**
 * Play a context (album/playlist/artist URI), optionally starting at a specific
 * track within it. Used when a user clicks a track inside a list.
 */
export async function playContext(
  contextUri: string,
  offsetUri?: string,
): Promise<void> {
  const body: Record<string, unknown> = { context_uri: contextUri };
  if (offsetUri) body.offset = { uri: offsetUri };
  await startPlayback(body);
}

/** Play a single track immediately (no surrounding context). */
export async function playTrack(trackUri: string): Promise<void> {
  await startPlayback({ uris: [trackUri] });
}

export function getDeviceId(): string | null {
  return playerState.deviceId;
}
