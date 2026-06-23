// Golden-hour atmospheric backdrop: the night gradient + the Lumy indigo top-glow light-leak.
// Wrap a screen in this to get the brand background. Children render above the glow.

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme';

interface Props {
  children: React.ReactNode;
  variant?: 'night' | 'sunrise';
  glow?: boolean;
  style?: ViewStyle;
}

export default function GradientBackground({ children, variant = 'night', glow = true, style }: Props) {
  const base = variant === 'sunrise' ? gradients.sunrise : gradients.night;
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={base as any}
        locations={variant === 'night' ? (gradients.nightLocations as any) : undefined}
        style={StyleSheet.absoluteFill}
      />
      {glow && (
        <LinearGradient
          colors={gradients.glowTop as any}
          style={styles.glow}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1E' },
  // Vertical approximation of the radial indigo light-leak at the top of hero screens.
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%' },
});
