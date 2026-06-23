// Avatar — initials circle with optional golden ring + presence dot (DS core/Avatar).
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

export default function Avatar({
  name, size = 42, ring = false, status, bg = colors.green300, fg = colors.green700, style,
}: {
  name: string;
  size?: number;
  ring?: boolean;
  status?: 'online';
  bg?: string;
  fg?: string;
  style?: ViewStyle;
}) {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          {
            width: size, height: size, borderRadius: size / 2, backgroundColor: bg,
            borderWidth: ring ? 2.5 : 0, borderColor: colors.primary,
          },
        ]}
      >
        <Text style={{ color: fg, fontFamily: fonts.sansExtrabold, fontSize: size * 0.36 }}>{initials}</Text>
      </View>
      {status === 'online' && (
        <View style={[styles.status, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  status: {
    position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.green500,
    borderWidth: 2, borderColor: colors.surfacePage,
  },
});
