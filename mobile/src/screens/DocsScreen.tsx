// Screen 7 · Documents vault (documentsscreen.png) — stored IDs/certs with verify states.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TopBar, { circleBtnStyle } from '../ui/TopBar';
import Card from '../ui/Card';
import Icon, { IconName } from '../ui/Icon';
import { colors, fonts, radius, space } from '../theme';

type TFunc = (key: string) => string;

const buildDocs = (t: TFunc): { icon: IconName; title: string; sub: string; verified?: boolean }[] => [
  { icon: 'seal-check', title: t('docs.idCardTitle'), sub: t('docs.idCardSub'), verified: true },
  { icon: 'graduation-cap', title: t('docs.enrolmentTitle'), sub: t('docs.enrolmentSub') },
  { icon: 'file-text', title: t('docs.transcriptTitle'), sub: t('docs.transcriptSub') },
  { icon: 'house', title: t('docs.rentalTitle'), sub: t('docs.rentalSub') },
];

export default function DocsScreen({ onBack, onUpload }: { onBack: () => void; onUpload: () => void }) {
  const { t } = useTranslation();
  const DOCS = buildDocs(t);
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

        <Card style={styles.vault}>
          {DOCS.map((d, i) => (
            <View key={d.title} style={[styles.item, i < DOCS.length - 1 && styles.itemDivider]}>
              <View style={styles.iconTile}><Icon name={d.icon} size={21} color={colors.golden500} /></View>
              <View style={styles.flex}>
                <Text style={styles.itemTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>{d.sub}</Text>
              </View>
              {d.verified
                ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeDot}>●</Text>
                    <Text style={styles.badgeText}>{t('docs.verifiedBadge')}</Text>
                  </View>
                )
                : <Icon name="kebab" size={18} color={colors.textTertiary} />}
            </View>
          ))}
        </Card>
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
  cloud: { fontSize: 26 },
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
  itemDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  iconTile: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: 16 },
  itemSub: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 13, marginTop: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: space.s3, paddingVertical: 5,
  },
  badgeDot: { color: colors.success, fontSize: 8 },
  badgeText: { color: colors.success, fontFamily: fonts.sansBold, fontSize: 12 },
  kebab: { color: colors.textTertiary, fontSize: 20, paddingHorizontal: space.s2 },
});
