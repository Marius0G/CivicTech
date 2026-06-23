// VoiceSheet — frosted bottom-sheet picker for Hop's OpenAI Realtime voice (same pattern as
// LanguageSheet). Lists the available voices by name + character note; tapping one persists the
// choice (via setVoice) and applies it on Hop's next connection.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { colors, fonts, radius, space } from '../theme';
import { VOICES } from '../voice';

interface Props {
  visible: boolean;
  /** Currently active voice id (e.g. "marin"). */
  current: string;
  /** Called with the chosen voice id. */
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function VoiceSheet({ visible, current, onSelect, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{t('voice.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('voice.subtitle')}</Text>

        <Text style={styles.eyebrow}>{t('voice.eyebrow')}</Text>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {VOICES.map((v) => {
            const active = v.id === current;
            return (
              <Pressable key={v.id} style={styles.row} onPress={() => { onSelect(v.id); onClose(); }}>
                <View style={styles.labels}>
                  <Text style={[styles.name, active && styles.activeText]} numberOfLines={1}>{v.label}</Text>
                  <Text style={styles.desc} numberOfLines={1}>{v.description}</Text>
                </View>
                {active && <Icon name="check" size={16} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.surfaceScrim },
  sheet: {
    backgroundColor: colors.surfaceCard, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.s5, paddingBottom: space.s8, paddingTop: space.s2, maxHeight: '78%',
    borderTopWidth: 1, borderColor: colors.borderSubtle,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.s3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s2 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 20 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  subtitle: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 14, marginBottom: space.s1 },
  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6,
    paddingTop: space.s4, paddingBottom: space.s1, borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginTop: space.s3,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  labels: { flex: 1 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 16 },
  activeText: { color: colors.primary, fontFamily: fonts.sansBold },
  desc: { color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 1 },
});
