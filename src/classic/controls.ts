// Shared hotspot -> player-control dispatch for classic main-window faces. Both
// the in-page ClassicPlayer and the Document Picture-in-Picture player map a click
// to a HotspotName and hand it here, so the two windows stay behaviorally identical
// and there's a single place that translates skin hotspots into player actions.
// This only reads playerState and calls the existing control functions — no new
// player logic.

import { playerState } from '../player/playerStore';
import {
  togglePlay,
  nextTrack,
  previousTrack,
  seek,
  setVolume,
  toggleShuffle,
  cycleRepeat,
} from '../player/spotifyPlayer';
import { PLACE, POSBAR_THUMB_TRAVEL, VOLUME_THUMB_TRAVEL } from '../skins/sprites';
import { trackFraction, type HotspotName } from './geometry';

/** Act on a transport/slider hotspot. `nativeX` is the click x in native (unscaled)
 * skin pixels, used by the position bar and volume slider to compute a fraction. */
export function dispatchHotspot(hot: HotspotName, nativeX: number): void {
  switch (hot) {
    case 'prev':
      void previousTrack();
      break;
    case 'play':
      void togglePlay();
      break;
    case 'pause':
      void togglePlay();
      break;
    case 'stop':
      void togglePlay();
      break;
    case 'next':
      void nextTrack();
      break;
    case 'shuffle':
      void toggleShuffle();
      break;
    case 'repeat':
      void cycleRepeat();
      break;
    case 'posBar': {
      if (playerState.durationMs > 0) {
        const f = trackFraction(nativeX, PLACE.posBar.x, POSBAR_THUMB_TRAVEL);
        void seek(Math.round(f * playerState.durationMs));
      }
      break;
    }
    case 'volume': {
      const f = trackFraction(nativeX, PLACE.volume.x, VOLUME_THUMB_TRAVEL);
      void setVolume(f);
      break;
    }
    default:
      break;
  }
}
