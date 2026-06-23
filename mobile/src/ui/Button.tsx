// Button — RN port of the design system's Button (core/Button.jsx).
// Variants map to the DS: primary (golden), brand (Hop green), ghost, lime, danger.
// Tactile press: scale-down to 0.98 (DS press state). Sentence case copy.

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, shadow, space } from '../theme';

type Variant = 'primary' | 'brand' | 'ghost' | 'lime' | 'danger';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  left?: React.ReactNode;
  glow?: boolean;
  style?: ViewStyle;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  brand: { bg: colors.green600, fg: '#04170A' },
  ghost: { bg: 'transparent', fg: colors.textPrimary, border: colors.borderDefault },
  lime: { bg: colors.lime500, fg: '#26280A' },
  danger: { bg: colors.danger, fg: '#0A0F1E' },
};

export default function Button({
  label, onPress, variant = 'primary', size = 'md', block = false,
  disabled = false, left, glow = false, style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const v = VARIANTS[variant];
  const height = size === 'lg' ? 56 : 48;
  const fontSize = size === 'lg' ? 18 : 16;

  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Animated.View style={[block && styles.block, { transform: [{ scale }] }, glow && !disabled && shadow.primary]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => !disabled && press(0.98)}
        onPressOut={() => press(1)}
        style={[
          styles.base,
          {
            height,
            backgroundColor: disabled ? colors.night700 : v.bg,
            borderColor: v.border,
            borderWidth: v.border ? 1.5 : 0,
          },
          style,
        ]}
      >
        {left ? <View style={styles.left}>{left}</View> : null}
        <Text style={[styles.label, { color: disabled ? colors.textDisabled : v.fg, fontSize }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `block` = fill the container's width. We use alignSelf:stretch (NOT flex:1): flex-grow on a
  // child collapses to ~0 height inside an auto-height COLUMN (e.g. the login dock), stacking the
  // buttons on top of each other. To split a ROW evenly, wrap each button in a {flex:1} view.
  block: { alignSelf: 'stretch' },
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.s2, paddingHorizontal: space.s6, borderRadius: radius.md,
  },
  left: { marginRight: 2 },
  label: { fontFamily: fonts.sansBold, letterSpacing: 0.1 },
});
