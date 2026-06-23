// WEB twin of FormCanvas. A browser cannot script a cross-origin government form — the same-origin
// policy blocks reading/writing an <iframe>'s document, and there's no injectJavaScript equivalent.
// So the autopilot can't auto-fill on web: App's openForm() opens the real form in a NEW TAB, and
// Hoppy dictates what to type. injectAndWait resolves with a clear "not available on web" result so
// the model tells the user the values instead of trying (and silently failing) to fill them.

import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';

export interface FormCanvasHandle {
  injectAndWait: (js: string, requestId: string) => Promise<any>;
}

interface Props {
  formUrl: string;
}

export default forwardRef<FormCanvasHandle, Props>(function FormCanvas({ formUrl }, ref) {
  useImperativeHandle(
    ref,
    () => ({
      injectAndWait: async () => ({
        result: {
          ok: false,
          web: true,
          errors: [
            'Auto-fill is unavailable in the web version. The official form was opened in a new '
              + 'browser tab — read the values out to the user and ask them to type them in there.',
          ],
        },
      }),
    }),
    []
  );

  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>🪟↗</Text>
      <Text style={styles.title}>The official form opened in a new tab</Text>
      <Text style={styles.body}>
        For your security, browsers don’t let Hoppy type directly into government sites. Switch to
        the new tab — Hoppy will tell you exactly what to enter in each field.
      </Text>
      <Text style={styles.link} onPress={() => Linking.openURL(formUrl)}>
        Re-open the form ↗
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1437', alignItems: 'center', justifyContent: 'center', padding: 28 },
  emoji: { fontSize: 44, marginBottom: 16 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  body: { color: '#AEB6CC', fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
  link: { color: '#F5C24B', fontSize: 15, fontWeight: '700', marginTop: 22 },
});
