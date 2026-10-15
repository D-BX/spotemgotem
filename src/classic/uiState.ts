// Lightweight open-state signals for classic mode. Kept free of any heavy imports
// (no skin parser, no fflate) so the app shell can toggle the windows and lazy-load
// the real UI only when they first open — keeping the initial bundle small.

import { createSignal } from 'solid-js';

export const [classicOpen, setClassicOpen] = createSignal(false);
export const [playlistOpen, setPlaylistOpen] = createSignal(false);
