// Screen 8 · File upload (documentuploadscreen.png) — add a document; Pip auto-extracts fields.
// Browse → gallery picker, Scan with camera → the ID camera. The "uploading" card mirrors the
// screenshot; a real capture switches App into the processing/review flow.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../ui/TopBar';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import Mascot from '../Mascot';
import { colors, fonts, radius, space } from '../theme';

export default function UploadScreen({
  onBack, onBrowse, onScanCamera,
}: { onBack: () => void; onBrowse: () => void; onScanCamera: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <TopBar title="Add document" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Dropzone */}
        <View style={styles.dropzone}>
          <View style={styles.cloudCircle}><Icon name="cloud-upload" size={30} color={colors.golden500} weight="fill" /></View>
          <Text style={styles.dropTitle}>Drop a file here</Text>
          <Text style={styles.dropSub}>PDF, image or scan · up to 20 MB</Text>
          <Button
            label="Browse files"
            variant="lime"
            onPress={onBrowse}
            left={<Icon name="paperclip" size={18} color="#26280A" />}
            style={styles.browseBtn}
          />
        </View>

        <Button
          label="Scan with camera"
          variant="ghost"
          block
          onPress={onScanCamera}
          left={<Icon name="camera" size={18} />}
        />

        <Text style={styles.eyebrow}>UPLOADING</Text>
        <Card style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.fileTile}><Icon name="file-text" size={20} color={colors.sunset400} /></View>
            <View style={styles.flex}>
              <Text style={styles.fileName} numberOfLines={1}>enrolment-certificate.pdf</Text>
              <Text style={styles.fileMeta}>1.2 MB · 72%</Text>
            </View>
            <Icon name="close" size={18} color={colors.textTertiary} />
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: '72%' }]} /></View>
        </Card>

        <View style={styles.readingRow}>
          <Mascot speaking={false} celebrate={false} size={44} />
          <Text style={styles.readingText}>
            Pip is reading it — I’ll pull out your <Text style={styles.readingBold}>university & dates</Text> automatically.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: space.s4 + insets.bottom }]}>
        <Button label="Reading…" size="lg" block disabled />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { paddingHorizontal: space.s4, paddingBottom: space.s6, gap: space.s4 },

  dropzone: {
    borderWidth: 2, borderColor: colors.borderDefault, borderStyle: 'dashed', borderRadius: radius.xl,
    backgroundColor: colors.primarySoft, paddingVertical: space.s8, paddingHorizontal: space.s5,
    alignItems: 'center', gap: space.s2,
  },
  cloudCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.s1,
  },
  dropTitle: { color: colors.textPrimary, fontFamily: fonts.displayBold, fontSize: 18 },
  dropSub: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 14, textAlign: 'center' },
  browseBtn: { marginTop: space.s2 },

  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 13,
    letterSpacing: 0.6, marginLeft: space.s1, marginBottom: -space.s2,
  },
  progressCard: { padding: space.s4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginBottom: space.s3 },
  fileTile: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  fileName: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 15 },
  fileMeta: { color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 13, marginTop: 1 },
  close: { color: colors.textTertiary, fontSize: 16, paddingHorizontal: space.s2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },

  readingRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingHorizontal: space.s1 },
  readingText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 14, lineHeight: 19 },
  readingBold: { color: colors.textPrimary, fontFamily: fonts.sansBold },

  footer: { paddingHorizontal: space.s4, paddingBottom: space.s4, paddingTop: space.s2 },
});
