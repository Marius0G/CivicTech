// "Processing…" screen shown while the captured ID photo is uploaded + read (Phase 3 UX).

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import Mascot from './Mascot';

export default function IdProcessingScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Mascot speaking celebrate={false} size={120} />
      <ActivityIndicator color="#F5C24B" style={{ marginTop: 28 }} />
      <Text style={styles.title}>{t('idProcessing.title')}</Text>
      <Text style={styles.sub}>{t('idProcessing.subtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070F', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F4F6FB', fontSize: 20, fontWeight: '800', marginTop: 16 },
  sub: { color: '#AEB6CC', fontSize: 14, marginTop: 6 },
});
