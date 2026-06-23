// Chip / Pill — frosted glass pill for suggestions & status (DS core/Chip + frosted pills).
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

export default function Chip({
  label, onPress, left, tone = 'glass', style,
}: {
  label: string;
  onPress?: () => void;
  left?: React.ReactNode;
  tone?: 'glass' | 'primary' | 'success';
  style?: ViewStyle;
}) {
  const bg = tone === 'primary' ? colors.primarySoft : tone === 'success' ? colors.successSoft : colors.surfaceGlass;
  const fg = tone === 'primary' ? colors.golden300 : tone === 'success' ? colors.success : colors.textSecondary;
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={[styles.chip, { backgroundColor: bg }, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Comp>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2,
    paddingHorizontal: space.s4, paddingVertical: space.s2,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  left: { marginRight: 1 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13 },
});
