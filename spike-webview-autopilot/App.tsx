// Phase 0 spike: prove the autopilot trick — NOTHING ELSE lives here.
// Loads the REAL European Solidarity Corps eligibility form in a WebView and fills it
// from injected JS. The real app (with voice, mascot, tools) lives in ../mobile.
//
// This spike only uses react-native-webview, so it runs in **Expo Go** (no dev client).

import React, { useRef, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildInjectedJavaScript, EligibilityProfile } from './src/injection';

const ELIGIBILITY_URL = 'https://youth.europa.eu/solidarity/register/check_en';

// Stand-in for the profile that the real app will extract from the user's uploaded ID.
const DEMO_PROFILE: EligibilityProfile = {
  country: 'RO', // Romania (Drupal option value)
  birthdate: '2006-05-14',
};

export default function App() {
  const webRef = useRef<WebView>(null);
  const [status, setStatus] = useState('Form loading…');
  const [loaded, setLoaded] = useState(false);

  function runAutopilot() {
    setStatus('🐸 Filling the form…');
    webRef.current?.injectJavaScript(buildInjectedJavaScript(DEMO_PROFILE));
  }

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'fill_form_result') {
        const r = msg.result;
        setStatus(
          r.ok
            ? `✅ Filled: ${r.countryLabel} + DOB ${DEMO_PROFILE.birthdate}`
            : `⚠️ Partial: ${r.errors.join('; ')}`
        );
      } else if (msg.type === 'fill_form_error') {
        setStatus(`❌ Injection error: ${msg.error}`);
      }
    } catch {
      // non-JSON message from the page; ignore
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>🐸 Autopilot spike</Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      <WebView
        ref={webRef}
        source={{ uri: ELIGIBILITY_URL }}
        onMessage={onMessage}
        onLoadEnd={() => {
          setLoaded(true);
          setStatus('Form ready. Tap “Autopilot fill”.');
        }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
      />

      <TouchableOpacity
        style={[styles.btn, !loaded && styles.btnDisabled]}
        onPress={runAutopilot}
        disabled={!loaded}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>🐸 Autopilot fill (Romania · 2006-05-14)</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1437' },
  header: { paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: '#ffd617', fontSize: 18, fontWeight: '700' }, // EU-flag yellow
  status: { color: '#cbd5e1', fontSize: 13, marginTop: 2 },
  web: { flex: 1 },
  btn: {
    backgroundColor: '#1b9e4b',
    margin: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#475569' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
