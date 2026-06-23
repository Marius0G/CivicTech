// Screen 10 · Erasmus helper (formhelpscreen.png) — the "browser" that pops up ONLY when the
// voice agent opens a form. Real WebView lives in the white panel (passed as children so App
// keeps the autopilot ref); the REC chrome + Pip coaching dock are ours.

import React from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Anchor, { Rect } from '../ui/Anchor';
import { MASCOT_DOCK_SIZE } from '../mascotProps';
import GradientBackground from '../ui/GradientBackground';
import Icon from '../ui/Icon';
import { colors, fonts, radius, shadow, space } from '../theme';

interface Props {
  host: string;
  coaching: string;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode; // the live WebView (owned by App)
  /** Report the coaching-dock slot's window rect so App can fly the persistent Mascot into it. */
  onDockAnchor: (r: Rect) => void;
  /** Bump to force the dock Anchor to re-measure (web: the slide settles after the tab refocuses). */
  dockRemeasure?: number;
}

export default function ErasmusHelperScreen({
  host, coaching, onClose, onConfirm, children, onDockAnchor, dockRemeasure,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <GradientBackground variant="night">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + space.s2 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.glassBtn}>
            <Icon name="arrow-left" size={20} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.title}>Web Assistant</Text>
            <Text style={styles.watching}>
              {Platform.OS === 'web' ? '● Guiding you through the form' : '● Pip is watching your screen'}
            </Text>
          </View>
          <View style={styles.recBadge}><Text style={styles.recText}>● REC</Text></View>
        </View>

        {/* Shared-screen browser panel (real WebView inside) */}
        <View style={styles.panel}>
          <View style={styles.chrome}>
            <View style={styles.chromeDot} />
            <View style={styles.urlBar}>
              <Text style={styles.urlText} numberOfLines={1}>{host}</Text>
            </View>
          </View>
          <View style={styles.web}>{children}</View>
        </View>

        {/* Pip coaching dock */}
        <View style={[styles.dock, { marginBottom: space.s4 + insets.bottom }]}>
          {/* Dock slot — the persistent Mascot overlay (App) flies in here while Pip is driving. */}
          <Anchor size={MASCOT_DOCK_SIZE} onMeasure={onDockAnchor} remeasure={dockRemeasure} />
          <Text style={styles.coaching} numberOfLines={3}>{coaching}</Text>
          <Pressable style={[styles.check, shadow.primary]} onPress={onConfirm}>
            <Icon name="check" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    paddingHorizontal: space.s4, paddingBottom: space.s2,
  },
  glassBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  back: { color: colors.textPrimary, fontSize: 22 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16 },
  watching: { color: colors.green400, fontFamily: fonts.sansMedium, fontSize: 12, marginTop: 1 },
  recBadge: { backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: space.s3, paddingVertical: 6 },
  recText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 12 },

  panel: {
    flex: 1, marginHorizontal: space.s4, borderRadius: 18, backgroundColor: '#fff',
    overflow: 'hidden', ...shadow.card,
  },
  chrome: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2,
    paddingHorizontal: space.s3, paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: '#E8ECF3',
  },
  chromeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CDD3DE' },
  urlBar: { flex: 1, height: 26, borderRadius: 6, backgroundColor: '#F0F2F7', justifyContent: 'center', paddingHorizontal: space.s2 },
  urlText: { color: '#8A93A5', fontSize: 12, fontFamily: fonts.sansMedium },
  web: { flex: 1, backgroundColor: '#fff' },

  dock: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    margin: space.s4, padding: space.s4, borderRadius: 18,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  coaching: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19 },
  check: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { color: colors.onPrimary, fontSize: 22, fontFamily: fonts.sansBold },
});
