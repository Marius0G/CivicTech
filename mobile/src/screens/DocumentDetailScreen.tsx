// Read-only detail for a saved document in the vault. Opened from DocsScreen when the user taps
// their identity card — it shows the REAL fields extracted from the scan (only the filled ones).
//
// These values belong to the user and are shown on THEIR device; this is not the AI's context
// (the assistant only ever sees field names — see app/tools.py). So showing them here is fine.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import TopBar from '../ui/TopBar';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { colors, fonts, radius, space } from '../theme';
import { ExtractedProfile } from '../profileUpload';

type Row = { label: string; value: string };

const buildRows = (t: TFunction, p: ExtractedProfile): Row[] => {
  const f = (key: keyof ExtractedProfile, label: string): Row => ({
    label,
    value: String(p[key] ?? '').trim(),
  });
  return [
    f('last_name', t('idReview.lastNameLabel')),
    f('first_name', t('idReview.firstNameLabel')),
    f('cnp', t('idReview.cnpLabel')),
    f('sex', t('idReview.sexLabel')),
    f('birthdate', t('idReview.birthdateLabel')),
    f('place_of_birth', t('idReview.placeOfBirthLabel')),
    f('nationality', t('idReview.nationalityLabel')),
    f('address', t('idReview.addressLabel')),
    f('series', t('idReview.seriesLabel')),
    f('doc_number', t('idReview.docNumberLabel')),
    f('issued_by', t('idReview.issuedByLabel')),
    f('issue_date', t('idReview.issueDateLabel')),
    f('expiry_date', t('idReview.expiryDateLabel')),
  ].filter((r) => r.value !== '');
};

export default function DocumentDetailScreen({
  profile, onBack,
}: {
  profile: ExtractedProfile;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const rows = buildRows(t, profile);
  const holder = profile.name
    || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    || t('docs.idCardTitle');

  return (
    <View style={styles.safe}>
      <TopBar title={t('docs.idCardTitle')} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Header card with the holder name. */}
        <View style={styles.headerCard}>
          <View style={styles.idIcon}><Icon name="seal-check" size={28} color={colors.golden500} /></View>
          <Text style={styles.holder} numberOfLines={2}>{holder}</Text>
          <Text style={styles.holderSub}>{t('docs.idCardOnFileSub')}</Text>
        </View>

        <Text style={styles.eyebrow}>{t('docs.detailEyebrow')}</Text>

        <Card style={styles.fields}>
          {rows.map((r, i) => (
            <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue} numberOfLines={2}>{r.value}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s4 },

  headerCard: {
    alignItems: 'center', gap: space.s1,
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderSubtle,
    borderRadius: radius.xl, paddingVertical: space.s6, paddingHorizontal: space.s4,
  },
  idIcon: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.s2,
  },
  holder: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 20, textAlign: 'center' },
  holderSub: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 13 },

  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 13,
    letterSpacing: 0.6, marginLeft: space.s1, marginBottom: -space.s1,
  },
  fields: { paddingHorizontal: space.s4 },
  row: { paddingVertical: space.s3 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  rowLabel: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  rowValue: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 16, marginTop: 3 },
});
