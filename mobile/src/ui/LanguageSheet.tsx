// LanguageSheet — frosted bottom-sheet language picker (same pattern as LocationSheet).
// Lists the app's supported languages by endonym + flag; tapping one switches the whole app
// (and Hoppy's voice on the next connection) via the i18n setLanguage helper.

import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { colors, fonts, radius, space } from '../theme';
import { LANGUAGES } from '../i18n';

interface Props {
  visible: boolean;
  /** Currently active language code (e.g. "en"). */
  current: string;
  /** Called with the chosen language code. */
  onSelect: (code: string) => void;
  onClose: () => void;
}

export default function LanguageSheet({ visible, current, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.native.toLowerCase().includes(needle) ||
        l.label.toLowerCase().includes(needle) ||
        l.code.toLowerCase().includes(needle)
    );
  }, [q]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={colors.textTertiary} weight="regular" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('language.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.eyebrow}>{t('language.eyebrow')}</Text>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {list.map((l) => {
            const active = l.code === current;
            return (
              <Pressable key={l.code} style={styles.row} onPress={() => { onSelect(l.code); onClose(); }}>
                <Text style={styles.flag}>{l.flag}</Text>
                <View style={styles.labels}>
                  <Text style={[styles.native, active && styles.activeText]} numberOfLines={1}>{l.native}</Text>
                  <Text style={styles.englishName} numberOfLines={1}>{l.label}</Text>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s3 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 20 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2, height: 48, paddingHorizontal: space.s4,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 15, padding: 0 },
  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6,
    paddingTop: space.s4, paddingBottom: space.s1, borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginTop: space.s3,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  flag: { fontSize: 24 },
  labels: { flex: 1 },
  native: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 16 },
  activeText: { color: colors.primary, fontFamily: fonts.sansBold },
  englishName: { color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 1 },
});
