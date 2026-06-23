// Screen 3 · Main · Pip hub — the immersive voice home.
// Big glowing Pip + a time-based greeting, a BIG mic button (idle → connecting spinner →
// listening), and the quick-chips + "Ask Pip anything…" bar. When the channel is live the
// greeting hides, Pip grows (speaking), the chips give way to live tool-call cards.

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Easing, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Anchor, { Rect } from '../ui/Anchor';
import { MASCOT_HERO_SIZE } from '../mascotProps';
import Icon, { IconName } from '../ui/Icon';
import { colors, fonts, radius, shadow, space } from '../theme';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

const buildChips = (t: TFn) => [
  t('home.chipErasmusDeadlines'),
  t('home.chipFindHousing'),
  t('home.chipTranslateLetter'),
  t('home.chipGrantEligibility'),
];

export type ToolStatus = 'running' | 'done' | 'error';
export interface ToolEvent {
  id: string;
  name: string;
  detail?: string;
  status: ToolStatus;
}

const buildToolMeta = (t: TFn): Record<string, { icon: IconName; label: string }> => ({
  open_form: { icon: 'globe', label: t('home.toolOpenForm') },
  fill_form: { icon: 'file-text', label: t('home.toolFillForm') },
  read_page: { icon: 'search', label: t('home.toolReadPage') },
  get_profile: { icon: 'user', label: t('home.toolGetProfile') },
  search_eu_info: { icon: 'search', label: t('home.toolSearchEuInfo') },
  web_search: { icon: 'globe', label: t('home.toolWebSearch') },
});

function greetingWord(t: TFn): string {
  const h = new Date().getHours();
  if (h < 12) return t('home.greetingMorning');
  if (h < 18) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

interface Props {
  name?: string;
  location: string;
  voiceStatus: string;
  connected: boolean;
  connecting: boolean;
  toolEvents: ToolEvent[];
  onToggleVoice: () => void;
  onOpenChat: () => void;
  onLocation: () => void;
  /** Open the notifications settings sheet (bell icon). */
  onNotifications: () => void;
  /** Whether notifications are currently enabled — tints the bell. */
  notifEnabled?: boolean;
  /** Report the hero slot's window rect so App can fly the persistent Mascot into it. */
  onHeroAnchor: (r: Rect) => void;
  /** Tap on Pip (the overlay is pointerEvents:none, so the touch lands on this slot) → poke. */
  onPokeMascot?: () => void;
}

export default function MainScreen({
  name, location, voiceStatus, connected, connecting,
  toolEvents, onToggleVoice, onOpenChat, onLocation, onNotifications, notifEnabled, onHeroAnchor, onPokeMascot,
}: Props) {
  const { t } = useTranslation();
  // Listening pulse ring (connected) + connecting rotation.
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const cardsRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!connected) { pulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [connected, pulse]);

  useEffect(() => {
    if (!connecting) { spin.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [connecting, spin]);

  useEffect(() => {
    const t = setTimeout(() => cardsRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [toolEvents.length]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const greeting = name ? t('home.greetingNamed', { greeting: greetingWord(t), name }) : greetingWord(t);
  const chips = buildChips(t);
  const toolMeta = buildToolMeta(t);

  return (
    <View style={styles.safe}>
      {/* Top row — bell on the LEFT (the global language button lives top-right). */}
      <View style={[styles.topRow, { paddingTop: insets.top + space.s2 }]}>
        <Pressable style={styles.bell} onPress={onNotifications} hitSlop={6} accessibilityLabel="Notifications">
          <Icon
            name="bell"
            size={19}
            color={notifEnabled ? colors.primary : colors.textPrimary}
            weight={notifEnabled ? 'fill' : 'regular'}
          />
        </Pressable>
        <Pressable style={styles.locPill} onPress={onLocation}>
          <Icon name="map-pin" size={15} color={colors.textPrimary} />
          <Text style={styles.locText} numberOfLines={1}>{location}</Text>
          <Icon name="caret-down" size={12} color={colors.textTertiary} weight="bold" />
        </Pressable>
      </View>

      {/* Center hero */}
      <View style={styles.center}>
        {/* Hero slot — the real Mascot is a persistent overlay in App that flies into this rect.
            Wrapped in a Pressable so a tap where Pip sits pokes it (overlay is pointerEvents:none). */}
        <Pressable onPress={onPokeMascot} hitSlop={8}>
          <Anchor size={MASCOT_HERO_SIZE} onMeasure={onHeroAnchor} />
        </Pressable>

        {!connected && <Text style={styles.greeting}>{greeting}</Text>}

        {/* BIG mic — idle (golden mic) → connecting (blue spinner) → listening (red stop) */}
        <View style={styles.micWrap}>
          {connected && (
            <Animated.View style={[styles.micRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          )}
          {connecting ? (
            <View style={styles.spinnerWrap}>
              <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
            </View>
          ) : (
            <Pressable onPress={onToggleVoice} style={[styles.micBtn, connected ? styles.micBtnOn : shadow.primary]}>
              {connected ? <View style={styles.stopSquare} /> : <Icon name="mic" size={38} color={colors.onPrimary} weight="fill" />}
            </Pressable>
          )}
        </View>
        <Text style={styles.micHint} numberOfLines={2}>
          {connecting ? t('home.connecting') : connected ? voiceStatus : t('home.tapToTalk')}
        </Text>

        {/* Live tool-call cards (only while connected), in the space below the mic */}
        {connected && toolEvents.length > 0 && (
          <ScrollView
            ref={cardsRef}
            style={styles.cards}
            contentContainerStyle={styles.cardsContent}
            showsVerticalScrollIndicator={false}
          >
            {toolEvents.map((ev) => {
              const meta = toolMeta[ev.name] || { icon: 'check' as IconName, label: ev.name };
              return (
                <View key={ev.id} style={styles.card}>
                  <View style={styles.cardIcon}><Icon name={meta.icon} size={16} color={colors.primary} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.cardLabel} numberOfLines={1}>{meta.label}</Text>
                    {!!ev.detail && <Text style={styles.cardDetail} numberOfLines={1}>{ev.detail}</Text>}
                  </View>
                  {ev.status === 'running' && <ActivityIndicator size="small" color={colors.textTertiary} />}
                  {ev.status === 'done' && <Icon name="check" size={16} color={colors.success} />}
                  {ev.status === 'error' && <Icon name="close" size={16} color={colors.danger} />}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Bottom dock — chips (hidden while connected) + Ask Pip bar */}
      <View style={styles.dock}>
        {!connected && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((c) => (
              <Pressable key={c} style={styles.chip} onPress={onOpenChat}>
                <Text style={styles.chipText}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Pressable style={styles.askBar} onPress={onOpenChat}>
          <Text style={styles.askText}>{t('home.askPipPlaceholder')}</Text>
          <Pressable style={styles.askMic} onPress={onToggleVoice}>
            <Icon name="mic" size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.askSend}><Icon name="arrow-up" size={20} color={colors.onPrimary} /></View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.s2,
    paddingHorizontal: space.s4, paddingBottom: space.s2,
  },
  locPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '62%',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.pill, paddingHorizontal: space.s3, paddingVertical: 7,
  },
  locText: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 13, flexShrink: 1 },
  bell: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderSubtle,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s6 },
  heroGlow: {
    position: 'absolute', top: '24%', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(0,231,99,0.10)',
  },
  greeting: {
    color: colors.textPrimary, fontFamily: fonts.display, fontSize: 27,
    letterSpacing: -0.5, marginTop: space.s4, textAlign: 'center',
  },

  micWrap: { alignItems: 'center', justifyContent: 'center', marginTop: space.s6, height: 88 },
  micRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary },
  micBtn: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  micBtnOn: { backgroundColor: colors.danger },
  stopSquare: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#fff' },
  spinnerWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  spinner: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 6,
    borderColor: 'rgba(91,140,255,0.18)', borderTopColor: colors.euBlue,
  },
  micHint: {
    color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 13,
    textAlign: 'center', marginTop: space.s3, minHeight: 18, paddingHorizontal: space.s6,
  },

  cards: { maxHeight: 168, width: '100%', marginTop: space.s3 },
  cardsContent: { gap: space.s2, paddingVertical: space.s1 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.md, paddingHorizontal: space.s3, paddingVertical: space.s2,
  },
  cardIcon: {
    width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  cardLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 13 },
  cardDetail: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 11, marginTop: 1 },

  dock: { paddingHorizontal: space.s4, paddingBottom: space.s4 },
  chips: { gap: space.s2, paddingBottom: space.s3, paddingRight: space.s4 },
  chip: {
    backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.pill, paddingHorizontal: space.s4, paddingVertical: space.s2,
  },
  chipText: { color: colors.textSecondary, fontFamily: fonts.sansSemibold, fontSize: 13 },
  askBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2, height: 56,
    backgroundColor: colors.surfaceFrost, borderWidth: 1, borderColor: colors.borderDefault,
    borderRadius: radius.pill, paddingLeft: space.s5, paddingRight: 6,
  },
  askText: { flex: 1, color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 15 },
  askMic: { padding: 6 },
  askSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
