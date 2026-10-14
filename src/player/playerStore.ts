// The single reactive player store. Both the modern UI (and, later, the classic
// skin UI) read from and dispatch to this one store. The SDK wrapper writes to
// it; views subscribe to it.

import { createStore } from 'solid-js/store';

export interface PlayerTrack {
  uri: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
}

// Mirrors the SDK's repeat_mode: 0 = off, 1 = context, 2 = track.
export type RepeatMode = 0 | 1 | 2;

export interface PlayerState {
  isReady: boolean; // SDK connected and has a device_id
  deviceId: string | null;
  isActive: boolean; // our device currently holds playback state
  paused: boolean;
  track: PlayerTrack | null;
  positionMs: number;
  durationMs: number;
  volume: number; // 0..1
  shuffle: boolean;
  repeatMode: RepeatMode;
  error: string | null;
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  isReady: false,
  deviceId: null,
  isActive: false,
  paused: true,
  track: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.5,
  shuffle: false,
  repeatMode: 0,
  error: null,
};

const [playerState, setPlayerState] = createStore<PlayerState>({
  ...INITIAL_PLAYER_STATE,
});

export { playerState, setPlayerState };
