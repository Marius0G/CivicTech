// NotificationSheet — frosted bottom-sheet to turn notifications on/off (same pattern as
// LanguageSheet / LocationSheet). Toggling ON triggers the OS permission request (see
// src/notifications.ts); the choice is persisted by the caller.

import React from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { colors, fonts, radius, space } from '../theme';

interface Props {
  visible: boolean;
  /** Whether notifications are currently enabled. */
  enabled: boolean;
  /** Called with the desired next state. */
  onToggle: (next: boolean) => void;
  onClose: () => void;
}

export default function NotificationSheet({ visible, enabled, onToggle, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.body}>{t('notifications.body')}</Text>

        <Pressable style={styles.row} onPress={() => onToggle(!enabled)}>
          <View style={styles.iconWrap}>
            <Icon name="bell" size={18} color={colors.primary} weight={enabled ? 'fill' : 'regular'} />
          </View>
          <Text style={styles.rowLabel}>{t('notifications.receive')}</Text>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </Pressable>

        <Text style={styles.hint}>
          {enabled ? t('notifications.onHint') : t('notifications.offHint')}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.surfaceScrim },
  sheet: {
    backgroundColor: colors.surfaceCard, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.s5, paddingBottom: space.s8, paddingTop: space.s2,
    borderTopWidth: 1, borderColor: colors.borderSubtle,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.s3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s2 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 20 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  body: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, marginBottom: space.s4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
    paddingHorizontal: space.s4, paddingVertical: space.s3,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowLabel: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 15 },
  hint: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, marginTop: space.s3 },
});
