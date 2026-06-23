// Screen 7 · Documents vault — the user's REAL documents. Empty until they scan an ID; once a
// profile is saved, the identity card shows here and opens a read-only detail view on tap.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TopBar, { circleBtnStyle } from '../ui/TopBar';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { colors, fonts, radius, space } from '../theme';
import { ExtractedProfile } from '../profileUpload';

// Fields that mean "an ID has actually been scanned & saved" (so we show the card, not empty).
const ID_PRESENCE_FIELDS: (keyof ExtractedProfile)[] = [
  'name', 'last_name', 'first_name', 'cnp', 'birthdate', 'doc_number',
];

export function hasIdOnFile(profile: ExtractedProfile | null | undefined): boolean {
  return !!profile && ID_PRESENCE_FIELDS.some((k) => String(profile[k] ?? '').trim() !== '');
}

export default function DocsScreen({
  onBack, onUpload, profile, onOpenDoc,
}: {
  onBack: () => void;
  onUpload: () => void;
  profile: ExtractedProfile | null;
  onOpenDoc: () => void;
}) {
  const { t } = useTranslation();
  const hasId = hasIdOnFile(profile);
  const holder = profile?.name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  return (
    <View style={styles.safe}>
      <TopBar
        title={t('docs.screenTitle')}
        onBack={onBack}
        trailing={<View style={styles.circleBtn}><Icon name="search" size={19} /></View>}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Upload prompt */}
        <View style={styles.promptCard}>
          <Icon name="cloud-upload" size={28} color={colors.primary} weight="fill" />
          <Text style={styles.promptText}>
            {t('docs.promptPrefix')}<Text style={styles.promptBold}>{t('docs.promptHighlight')}</Text>{t('docs.promptSuffix')}
          </Text>
          <Pressable style={styles.uploadBtn} onPress={onUpload}>
            <Text style={styles.uploadText}>{t('docs.uploadButton')}</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>{t('docs.vaultEyebrow')}</Text>

        {hasId ? (
          <Card style={styles.vault}>
            <Pressable style={styles.item} onPress={onOpenDoc}>
              <View style={styles.iconTile}><Icon name="seal-check" size={21} color={colors.golden500} /></View>
              <View style={styles.flex}>
                <Text style={styles.itemTitle} numberOfLines={1}>{t('docs.idCardTitle')}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>{holder || t('docs.idCardOnFileSub')}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          </Card>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Icon name="folder" size={28} color={colors.textTertiary} /></View>
            <Text style={styles.emptyTitle}>{t('docs.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('docs.emptyBody')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  circleBtn: circleBtnStyle,
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s4 },

  promptCard: {
    flexDirection: 'row', alignItems: 'center', gap: space.s3,
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.xl, padding: space.s4,
  },
  promptText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 14, lineHeight: 19 },
  promptBold: { color: colors.textPrimary, fontFamily: fonts.sansBold },
  uploadBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.s4, paddingVertical: space.s2 },
  uploadText: { color: colors.onPrimary, fontFamily: fonts.sansBold, fontSize: 14 },

  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 13,
    letterSpacing: 0.6, marginLeft: space.s1, marginBottom: -space.s1,
  },
  vault: { paddingHorizontal: space.s4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
  iconTile: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16 },
  itemSub: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 13, marginTop: 1 },

  empty: {
    alignItems: 'center', gap: space.s2, paddingVertical: space.s8, paddingHorizontal: space.s6,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.s1,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16 },
  emptyBody: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
