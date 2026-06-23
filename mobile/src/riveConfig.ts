// Rive asset wiring for the mascot. Until a rigged `pip.riv` exists (see assets/PIP_RIVE_SPEC.md)
// this stays `null`, and Mascot.tsx renders the SVG frog instead — so the app never shows a blank
// mascot and the un-built native Rive module is never even loaded.
//
// TO GO LIVE (after authoring pip.riv AND rebuilding the native app with `expo run:android`):
//   1) Drop the file at  mobile/assets/pip.riv
//   2) Change PIP_RIVE_SOURCE below to:  require('../assets/pip.riv')
//      (or, to load remotely without bundling:  { uri: 'https://your-cdn/pip.riv' })
//
// The CONTRACT constants below MUST match the names you give things inside the Rive editor.

import type { RiveFileInput } from '@rive-app/react-native';

/** null → SVG fallback. require('../assets/pip.riv') | { uri } → Rive. */
export const PIP_RIVE_SOURCE: RiveFileInput | null = null;

/** Artboard + state machine to play (must exist in pip.riv). */
export const PIP_ARTBOARD = 'Pip';
export const PIP_STATE_MACHINE = 'Pip';

/**
 * Data-binding property names on the artboard's default ViewModel. v2 Rive drives everything
 * through data binding (not legacy SM inputs), so the editor must expose exactly these:
 *   level     — Number 0..100   (voice loudness → jaw open)
 *   speaking  — Boolean         (true while Hoppy talks; idle vs talk blend)
 *   celebrate — Trigger         (fire once on success → jump/✨)
 */
export const PIP_PROP = {
  level: 'level',
  speaking: 'speaking',
  celebrate: 'celebrate',
} as const;

/** Rive `level` is 0..100; our amplitude is 0..1. */
export const LEVEL_SCALE = 100;
