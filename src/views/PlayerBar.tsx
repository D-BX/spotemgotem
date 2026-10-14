import { Show, type Component } from 'solid-js';
import { playerState } from '../player/playerStore';
import {
  cycleRepeat,
  nextTrack,
  previousTrack,
  seek,
  setVolume,
  toggleShuffle,
  togglePlay,
} from '../player/spotifyPlayer';

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const REPEAT_LABEL = ['Repeat: off', 'Repeat: all', 'Repeat: one'] as const;

const PlayerBar: Component = () => {
  const onSeek = (e: InputEvent): void => {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    void seek(value);
  };
  const onVolume = (e: InputEvent): void => {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    void setVolume(value);
  };

  return (
    <footer
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        'align-items': 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        background: '#111',
        color: '#eee',
        'border-top': '1px solid #333',
        'font-family': 'system-ui, sans-serif',
        'font-size': '0.85rem',
      }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.75rem', 'min-width': '14rem' }}>
        <Show when={playerState.track?.image}>
          {(src) => <img src={src()} alt="" width={48} height={48} />}
        </Show>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ 'white-space': 'nowrap', 'text-overflow': 'ellipsis', overflow: 'hidden' }}>
            {playerState.track?.name ?? 'Nothing playing'}
          </div>
          <div style={{ color: '#9aa', 'white-space': 'nowrap', 'text-overflow': 'ellipsis', overflow: 'hidden' }}>
            {playerState.track?.artists ?? ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
        <button type="button" onClick={() => void toggleShuffle()} style={{ opacity: playerState.shuffle ? 1 : 0.5 }}>
          Shuffle
        </button>
        <button type="button" onClick={() => void previousTrack()}>
          ◀◀
        </button>
        <button type="button" onClick={() => void togglePlay()}>
          {playerState.paused ? '▶' : '❚❚'}
        </button>
        <button type="button" onClick={() => void nextTrack()}>
          ▶▶
        </button>
        <button type="button" onClick={() => void cycleRepeat()} style={{ opacity: playerState.repeatMode === 0 ? 0.5 : 1 }}>
          {REPEAT_LABEL[playerState.repeatMode]}
        </button>
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem', flex: 1 }}>
        <span>{formatTime(playerState.positionMs)}</span>
        <input
          type="range"
          min={0}
          max={playerState.durationMs || 0}
          value={playerState.positionMs}
          onInput={onSeek}
          style={{ flex: 1 }}
          disabled={!playerState.isActive}
        />
        <span>{formatTime(playerState.durationMs)}</span>
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.25rem', width: '8rem' }}>
        <span>Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={playerState.volume}
          onInput={onVolume}
          style={{ flex: 1 }}
        />
      </div>

      <Show when={!playerState.isReady}>
        <span style={{ color: '#e67e22' }}>Connecting…</span>
      </Show>
    </footer>
  );
};

export default PlayerBar;
