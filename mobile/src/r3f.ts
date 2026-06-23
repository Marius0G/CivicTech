// Platform shim for react-three-fiber. Native (iOS/Android) uses the expo-gl-backed `/native`
// entry; web uses the DOM/WebGL entry (see r3f.web.ts). Mascot3D imports Canvas/useFrame from here
// so the same component renders the 3D Pip on every platform.
export { Canvas, useFrame } from '@react-three/fiber/native';
