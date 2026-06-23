// Hop — the EU Youth Buddy frog mascot. Public entry point; the renderer is swappable behind a
// stable props interface (MascotProps), so screens never change when we upgrade the art:
//
//   • glbConfig.HOP_GLB_SOURCE set + rebuilt → Mascot3D  (full 3D rig: 16 clips + mouthOpen lip-sync)
//   • riveConfig.HOP_RIVE_SOURCE set + rebuilt → MascotRive (Rive rig)
//   • neither configured                      → MascotSvg  (JS-only, no native build)
//
// Mascot3D / MascotRive are loaded LAZILY (require, not import) so their native runtimes (expo-gl /
// Rive) are never evaluated unless configured. A RendererBoundary catches any error from the native
// renderer and falls back to the SVG frog, so a missing native module / load failure can never blank
// or crash the mascot — worst case you see the (always-working) SVG Hop.

import React from 'react';
import { MascotProps } from './mascotProps';
import MascotSvg from './MascotSvg';
import { HOP_GLB_SOURCE, HOP_GLB_MIN_SIZE } from './glbConfig';
import { HOP_RIVE_SOURCE } from './riveConfig';
import { shadow, colors } from './theme';

export type { MascotProps };

class RendererBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('[Mascot] native renderer failed → SVG fallback', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Mascot(props: MascotProps) {
  if (HOP_GLB_SOURCE != null && (props.size ?? 128) >= HOP_GLB_MIN_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Mascot3D = require('./Mascot3D').default as React.ComponentType<MascotProps & { source: number }>;
    return (
      <RendererBoundary fallback={<MascotSvg {...props} />}>
        <Mascot3D source={HOP_GLB_SOURCE} {...props} />
      </RendererBoundary>
    );
  }
  if (HOP_RIVE_SOURCE != null) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MascotRive = require('./MascotRive').default as React.ComponentType<MascotProps & { source: any }>;
    return (
      <RendererBoundary fallback={<MascotSvg {...props} />}>
        <MascotRive source={HOP_RIVE_SOURCE} {...props} />
      </RendererBoundary>
    );
  }
  return <MascotSvg {...props} />;
}

// Soft glow halo to sit behind the mascot on dark surfaces (use in screens).
export const mascotGlow = shadow.glowGreen;
export { colors as mascotColors };
