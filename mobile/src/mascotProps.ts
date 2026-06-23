// Shared mascot contract — kept in its own file so MascotSvg / MascotRive / Mascot can all import
// it without a circular dependency. The props are the WHOLE interface: SVG today, Rive tomorrow,
// same shape, so screens never change when we swap the renderer.

import { Animated } from 'react-native';

/** High-level behaviour state — the 3D renderer maps each to a base looping clip. */
export type MascotActivity = 'idle' | 'listening' | 'thinking' | 'talking';

// Canonical mascot sizes for the persistent-overlay transition (App.tsx flies ONE Mascot between
// these): the home hero size and the in-control coaching-dock size. The center↔dock animation and
// the MainScreen / ErasmusHelperScreen anchor slots all read these so they can never drift apart.
export const MASCOT_HERO_SIZE = 156;
export const MASCOT_DOCK_SIZE = 52;

export interface MascotProps {
  /** Gate the talking mouth. */
  speaking: boolean;
  /** Fire a one-shot celebrate (jump + ✨). */
  celebrate: boolean;
  size?: number;
  palette?: 'green' | 'blue' | 'coral';
  /** High-level state (3D renderer picks the base loop). Optional — falls back to speaking→talk. */
  activity?: MascotActivity;
  /** Fire a one-shot gesture: bump `nonce` to (re)trigger `name` (e.g. Nod/Sad/Point/Poke/Wave). */
  gesture?: { name: string; nonce: number };
  /**
   * OPTIONAL live 0..1 voice loudness (see audioLevel.ts). When supplied it drives the jaw for
   * true lip-sync — the SVG renderer interpolates it directly, the Rive renderer pushes it into
   * the `level` data-binding property. When omitted, `speaking` drives a canned mouth oscillation.
   */
  levelValue?: Animated.Value;
}
