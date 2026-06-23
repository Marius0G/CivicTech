// Review & edit the data read from the ID before saving it (Phase 3 UX).
//
// Shows each extracted field as a tappable row: tap to edit inline. Nothing is stored until
// the user taps "Save" — "Cancel" discards the scan entirely. The values shown are the raw
// vision output (country as an English name); the backend normalises on save.

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { ExtractedProfile } from './profileUpload';

const ACCENT = '#F5C24B';

interface Props {
  initial: ExtractedProfile;
  saving?: boolean;
  error?: string | null;
  onSave: (edited: ExtractedProfile) => void;
  onCancel: () => void;
}

const buildFields = (t: TFunction): { key: keyof ExtractedProfile; label: string; placeholder: string; hint?: string }[] => [
  { key: 'name', label: t('idReview.nameLabel'), placeholder: t('idReview.namePlaceholder') },
  { key: 'birthdate', label: t('idReview.birthdateLabel'), placeholder: t('idReview.birthdatePlaceholder'), hint: t('idReview.birthdateHint') },
  { key: 'country', label: t('idReview.countryLabel'), placeholder: t('idReview.countryPlaceholder') },
  { key: 'nationality', label: t('idReview.nationalityLabel'), placeholder: t('idReview.nationalityPlaceholder') },
];

export default function IdReviewScreen({ initial, saving, error, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ExtractedProfile>({
    name: initial.name ?? '',
    birthdate: initial.birthdate ?? '',
    country: initial.country ?? '',
    nationality: initial.nationality ?? '',
  });
  const [editing, setEditing] = useState<keyof ExtractedProfile | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const FIELDS = buildFields(t);

  function set(key: keyof ExtractedProfile, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('idReview.title')}</Text>
        <Text style={styles.subtitle}>
          {t('idReview.subtitle')}
        </Text>

        <View style={styles.card}>
          {FIELDS.map((f, i) => {
            const isEditing = editing === f.key;
            const value = draft[f.key];
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.row, i < FIELDS.length - 1 && styles.rowDivider]}
                activeOpacity={0.7}
                onPress={() => setEditing(f.key)}
              >
                <Text style={styles.rowLabel}>{f.label}</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(t) => set(f.key, t)}
                    placeholder={f.placeholder}
                    placeholderTextColor="#5B6480"
                    autoFocus
                    autoCapitalize={f.key === 'birthdate' ? 'none' : 'words'}
                    keyboardType={f.key === 'birthdate' ? 'numbers-and-punctuation' : 'default'}
                    onBlur={() => setEditing(null)}
                    onSubmitEditing={() => setEditing(null)}
                    returnKeyType="done"
                  />
                ) : (
                  <View style={styles.valueRow}>
                    <Text style={[styles.value, !value && styles.valueEmpty]} numberOfLines={1}>
                      {value || f.placeholder}
                    </Text>
                    <Text style={styles.editHint}>{t('idReview.editAction')}</Text>
                  </View>
                )}
                {isEditing && !!f.hint && <Text style={styles.fieldHint}>{f.hint}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn]}
          onPress={onCancel}
          activeOpacity={0.8}
          disabled={saving}
        >
          <Text style={styles.cancelText}>{t('idReview.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, saving && styles.btnDisabled]}
          onPress={() => onSave(draft)}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#0A0F1E" /> : <Text style={styles.saveText}>{t('idReview.save')}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070F' },
  scroll: { padding: 24, paddingBottom: 24 },

  title: { color: '#F4F6FB', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: '#AEB6CC', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 22 },

  card: {
    backgroundColor: '#131B33',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 18, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowLabel: { color: '#7A839E', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  value: { color: '#F4F6FB', fontSize: 17, fontWeight: '600', flex: 1 },
  valueEmpty: { color: '#5B6480', fontWeight: '400', fontStyle: 'italic' },
  editHint: { color: ACCENT, fontSize: 13, fontWeight: '700', marginLeft: 10 },

  input: {
    color: '#F4F6FB', fontSize: 17, fontWeight: '600', marginTop: 4,
    borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: 4, paddingHorizontal: 0,
  },
  fieldHint: { color: '#7A839E', fontSize: 12, marginTop: 6 },

  error: { color: '#FF9E8E', fontSize: 14, fontWeight: '600', marginTop: 16, textAlign: 'center' },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,15,30,0.9)',
  },
  btn: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.7 },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  cancelText: { color: '#F4F6FB', fontSize: 16, fontWeight: '700' },
  saveBtn: { backgroundColor: ACCENT },
  saveText: { color: '#0A0F1E', fontSize: 16, fontWeight: '800' },
});
