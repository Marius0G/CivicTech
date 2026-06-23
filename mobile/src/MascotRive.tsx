// MascotRive — Hop rendered by the Rive runtime (@rive-app/react-native v2, Nitro). This is the
// "moves like a real creature" renderer: the .riv carries the rig + state machine, and we drive it
// purely through data binding (the modern v2 path; legacy state-machine inputs are deprecated).
//
// IMPORTANT: this module statically imports the native Rive runtime, so it must only be loaded once
// the native app has been rebuilt with the lib present. Mascot.tsx therefore `require()`s it lazily,
// and only when riveConfig.HOP_RIVE_SOURCE is set. Do not import this file unconditionally.
//
// Same MascotProps as MascotSvg. `levelValue` (0..1 Animated.Value) is pushed into the `level`
// data-binding property every frame for true lip-sync, with no React re-renders.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  RiveView, Fit, DataBindMode,
  useRiveFile, useViewModelInstance, useRiveNumber, useRiveBoolean, useRiveTrigger,
  type RiveFileInput,
} from '@rive-app/react-native';
import { MascotProps } from './mascotProps';
import {
  HOP_ARTBOARD, HOP_STATE_MACHINE, HOP_PROP, LEVEL_SCALE,
} from './riveConfig';

interface Props extends MascotProps {
  source: RiveFileInput;
}

export default function MascotRive({ source, speaking, celebrate, size = 128, levelValue }: Props) {
  const { riveFile, error } = useRiveFile(source);

  // Default ViewModel instance for the artboard — this is what data binding talks to.
  const { instance } = useViewModelInstance(riveFile ?? null, { artboardName: HOP_ARTBOARD });

  const { setValue: setLevel } = useRiveNumber(HOP_PROP.level, instance);
  const { setValue: setSpeaking } = useRiveBoolean(HOP_PROP.speaking, instance);
  const { trigger: fireCelebrate } = useRiveTrigger(HOP_PROP.celebrate, instance);

  // Live lip-sync: subscribe to the amplitude value and push it straight to Rive (no re-render).
  useEffect(() => {
    if (!levelValue) return;
    const id = levelValue.addListener(({ value }) => {
      const v = value < 0 ? 0 : value > 1 ? 1 : value;
      setLevel(v * LEVEL_SCALE);
    });
    return () => levelValue.removeListener(id);
  }, [levelValue, setLevel]);

  // talking on/off
  useEffect(() => { setSpeaking(speaking); }, [speaking, setSpeaking]);

  // one-shot celebrate
  useEffect(() => { if (celebrate) fireCelebrate(); }, [celebrate, fireCelebrate]);

  if (error || !riveFile) {
    // Asset failed to load or still loading — reserve layout space; no blank crash.
    return <View style={{ width: size, height: size }} />;
  }

  return (
    <View style={[styles.stage, { width: size, height: size }]} pointerEvents="none">
      <RiveView
        file={riveFile}
        artboardName={HOP_ARTBOARD}
        stateMachineName={HOP_STATE_MACHINE}
        dataBind={DataBindMode.Auto}
        autoPlay
        fit={Fit.Contain}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
});
