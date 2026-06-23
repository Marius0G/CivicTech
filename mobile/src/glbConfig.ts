// 3D mascot (pip.glb) wiring — same gating pattern as riveConfig. While HOP_GLB_SOURCE is null the
// app uses the SVG frog and the 3D stack (expo-gl/three) is never loaded, so the current build is
// safe before the native rebuild.
//
// TO GO LIVE (after `cd mobile && npx expo run:android`, which compiles expo-gl):
//   set  HOP_GLB_SOURCE = require('../assets/pip.glb')
//
// The clip names below MUST match the GLTF animation names authored in Blender (tools/pip.blend).

/** null → SVG fallback. require('../assets/pip.glb') → 3D Hop. (require() returns an asset id: number)
 *  ENABLED: takes effect after `npx expo run:android` compiles expo-gl. Until then the
 *  RendererBoundary in Mascot.tsx falls back to the SVG frog, so the JS-only build stays safe. */
export const HOP_GLB_SOURCE: number | null = require('../assets/pip.glb');

/** Activity → base looping clip. */
export const HOP_BASE_BY_ACTIVITY: Record<string, string> = {
  idle: 'Idle',
  talking: 'Talk',
  listening: 'Listen',
  thinking: 'Think',
  doze: 'Doze',
};

/** One-shot gestures Hop plays at random while idle (keeps it alive / pre-login wave + look-around).
 *  Wave is just one of many now, so the hand is NOT permanently raised — Hop rests both hands down
 *  and waves only when this picks 'Wave'. Bounce/Wiggle/Turn/Peek are full-body moves for liveliness. */
export const HOP_IDLE_GESTURES = [
  'Wave', 'LookAround', 'Stretch', 'HeadTilt', 'Wink', 'Hop',
  'Bounce', 'Wiggle', 'Turn', 'Peek',
];

/** After this long with no activity/gesture, Hop dozes off (Doze loop) until something happens. */
export const HOP_DOZE_AFTER_MS = 30000;

/** Morph target name (GLTF) the live voice loudness drives for lip-sync. */
export const HOP_MOUTH_MORPH = 'mouthOpen';

/** Min px size to use the 3D renderer (smaller → SVG fallback). 0 = always 3D, so the 40px tab-bar
 *  and chat-header Hop are the real 3D frog too (a few small GL canvases; fine for this app). */
export const HOP_GLB_MIN_SIZE = 0;
