// Media Session API wiring so macOS media keys and Control Center reflect and
// control playback. Handlers are supplied by the SDK wrapper to avoid a circular
// import.

import type { PlayerTrack } from './playerStore';

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  previousTrack: () => void;
  nextTrack: () => void;
  seekTo: (positionMs: number) => void;
}

function supported(): boolean {
  return 'mediaSession' in navigator;
}

export function updateMediaMetadata(track: PlayerTrack | null): void {
  if (!supported()) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: track.artists,
    album: track.album,
    artwork: track.image
      ? [{ src: track.image, sizes: '640x640', type: 'image/jpeg' }]
      : [],
  });
}

export function setMediaPlaybackState(paused: boolean): void {
  if (!supported()) return;
  navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';
}

export function setupMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  if (!supported()) return;
  navigator.mediaSession.setActionHandler('play', () => handlers.play());
  navigator.mediaSession.setActionHandler('pause', () => handlers.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () =>
    handlers.previousTrack(),
  );
  navigator.mediaSession.setActionHandler('nexttrack', () => handlers.nextTrack());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) handlers.seekTo(details.seekTime * 1000);
  });
}
