// Anchor — an invisible, layout-only slot that reports its window-space rectangle.
//
// Used by the persistent-Mascot overlay: MainScreen drops a hero-sized Anchor where the frog
// should sit, ErasmusHelperScreen drops a dock-sized one. App.tsx flies the single real Mascot
// between the two measured centers. Anchors render nothing and never intercept touches.
//
// We report measureInWindow() (NOT onLayout's parent-relative box) because the overlay lives in
// window space; onLayout only tells us the position inside the immediate parent.
//
// CRUCIAL: on Android measureInWindow returns the *drawn* position, which INCLUDES any animated
// transform on an ancestor. The dock Anchor lives inside the canvas, which mounts translated a
// full screen-height below the viewport and then springs up. onLayout fires once at mount — i.e.
// while the canvas is still off-screen — so a single measure would report a point ~a screen below
// the real dock and the frog would fly off the bottom. We therefore RE-MEASURE a few times after
// mount/layout to capture the settled (post-slide) position. Re-measures are idempotent for static
// anchors (e.g. the Home hero), so this is safe everywhere.

import React, { useCallback, useEffect, useRef } from 'react';
import { View, ViewStyle } from 'react-native';

export interface Rect {
  cx: number; // window-space center x
  cy: number; // window-space center y
  w: number;
  h: number;
}

interface Props {
  size: number;
  onMeasure: (r: Rect) => void;
  style?: ViewStyle;
}

// Re-measure offsets (ms) — spaced across a typical slide so the final one lands after it settles.
const RESETTLE_MS = [60, 250, 500, 750];

export default function Anchor({ size, onMeasure, style }: Props) {
  const ref = useRef<View>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const measure = useCallback(() => {
    // measureInWindow can fire before layout settles on Android (0×0) — ignore those frames.
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) onMeasure({ cx: x + w / 2, cy: y + h / 2, w, h });
    });
  }, [onMeasure]);

  // On every layout, measure now and again after the (possible) ancestor slide settles.
  const onLayout = useCallback(() => {
    measure();
    timers.current.forEach(clearTimeout);
    timers.current = RESETTLE_MS.map((ms) => setTimeout(measure, ms));
  }, [measure]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      pointerEvents="none"
      style={[{ width: size, height: size }, style]}
    />
  );
}
