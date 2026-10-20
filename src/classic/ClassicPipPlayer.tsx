// The classic player rendered to fill a Document Picture-in-Picture window. It reuses
// the shared ClassicFace (so it's pixel-identical to the in-page player) and only adds
// PiP-specific concerns: sizing the face to the PiP viewport and keeping its rAF-driven
// marquee running off the PiP window. The OS owns the window frame, so there's no
// dragging here (ClassicFace gets no onMoveBy).

import { createSignal, onCleanup, onMount } from 'solid-js';
import { MAIN_WIDTH, MAIN_HEIGHT } from '../skins/sprites';
import ClassicFace from './ClassicFace';

interface PipPlayerProps {
  win: Window;
}

const ClassicPipPlayer = (props: PipPlayerProps) => {
  const [scale, setScale] = createSignal(2);

  // Fit the 275x116 face to the PiP viewport with whole-pixel scaling.
  function fit(): void {
    const s = Math.max(
      1,
      Math.floor(Math.min(props.win.innerWidth / MAIN_WIDTH, props.win.innerHeight / MAIN_HEIGHT)),
    );
    setScale(s);
  }

  const onResize = (): void => fit();
  onMount(() => {
    fit();
    props.win.addEventListener('resize', onResize);
  });
  onCleanup(() => props.win.removeEventListener('resize', onResize));

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        background: '#000',
      }}
    >
      <ClassicFace scale={scale} win={props.win} />
    </div>
  );
};

export default ClassicPipPlayer;
