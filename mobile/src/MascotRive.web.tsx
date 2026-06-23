// WEB stub for MascotRive. @rive-app/react-native is native-only and won't bundle for the browser;
// riveConfig keeps PIP_RIVE_SOURCE = null so this is never rendered, but the stub keeps the Rive
// runtime out of the web bundle. Falls back to the SVG frog if ever mounted.
import React from 'react';
import { MascotProps } from './mascotProps';
import MascotSvg from './MascotSvg';

export default function MascotRive(props: MascotProps & { source?: any }) {
  return <MascotSvg {...props} />;
}
