// TopBar — circular back button + bold title + optional trailing control (DS navigation/TopBar).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, langSwitchReserve, radius, space } from '../theme';
import Icon from './Icon';

export default function TopBar({
  title, subtitle, onBack, trailing, leading,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.s2 }]}>
      {leading
        ? leading
        : onBack
          ? (
            <Pressable onPress={onBack} hitSlop={10} style={styles.circleBtn}>
              <Icon name="arrow-left" size={22} />
            </Pressable>
          )
          : null}
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export const circleBtnStyle = {
  width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const,
  backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    // Keep the right edge clear for the global language switcher (floats above every screen).
    paddingLeft: space.s4, paddingRight: langSwitchReserve, paddingBottom: space.s3,
  },
  flex: { flex: 1 },
  circleBtn: circleBtnStyle,
  back: { color: colors.textPrimary, fontSize: 22, lineHeight: 24, marginTop: -1 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 24, letterSpacing: -0.4 },
  subtitle: { color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 1 },
});
