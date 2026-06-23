// Full-screen document-capture camera (Phase 3 UX).
//
// A custom camera overlay so the user lines a document up inside a framed window. The user
// picks which kind of document they're scanning with a toggle below the camera:
//   • ID card    — a transparent cut-out in ID-1 aspect (85.6 × 54 mm ≈ 1.585:1, landscape)
//   • A4 page    — a transparent cut-out in A4 aspect (210 × 297 mm ≈ 1:1.414, portrait)
// plus a top banner with what to do and a bottom bar with quality tips, a centred shutter,
// and a gallery button.
//
// On capture (or gallery pick) it hands a { uri, mimeType } back to the caller, which uploads
// it to /docs/upload. We use expo-camera (CameraView) — expo-image-picker's camera launches the
// OS camera full-screen and can't host a custom overlay.

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { pickIdImage, PickedImage } from './profileUpload';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SCRIM = 'rgba(5, 7, 15, 0.82)';
const ACCENT = '#F5C24B'; // golden-hour primary

type DocType = 'id' | 'a4';

// Each overlay window: a transparent cut-out sized to the document's real aspect ratio.
// A4 is portrait, so we bound it by screen height to leave room for the scrims/controls, and
// bias it upward (smaller top scrim, larger bottom) so the tall frame doesn't push the controls
// off-screen or leave a big gap above the title. topFlex/bottomFlex weight the two scrims.
const A4_H = Math.round(SCREEN_H * 0.42);
const DOC_SPECS: Record<DocType, {
  width: number; height: number; title: string; hint: string; fileLabel: string;
  topFlex: number; bottomFlex: number;
}> = {
  id: {
    width: Math.round(SCREEN_W * 0.86),
    height: Math.round((SCREEN_W * 0.86) / 1.585), // ID-1 card aspect ratio (landscape)
    title: 'Take a photo of your ID card',
    hint: 'Fit the whole card inside the frame. Keep it flat, in good light, and make sure '
      + 'every line is sharp and readable — no glare or shadows.',
    fileLabel: 'id',
    topFlex: 1, bottomFlex: 1, // landscape frame is short — keep it centred
  },
  a4: {
    width: Math.round(A4_H / 1.414), // A4 portrait: height ≈ width × 1.414
    height: A4_H,
    title: 'Take a photo of your document',
    hint: 'Fit the whole A4 page inside the frame. Keep it flat, in good light, and make sure '
      + 'every line is sharp and readable — no glare or shadows.',
    fileLabel: 'document',
    topFlex: 0.5, bottomFlex: 1.25, // tall frame — pull everything up, give controls more room
  },
};

interface Props {
  onCaptured: (img: PickedImage) => void;
  onClose: () => void;
}

/** Tiny drawn "picture" glyph (framed photo with a sun + mountain) — no icon-font dependency. */
function GalleryGlyph() {
  return (
    <View style={glyph.frame}>
      <View style={glyph.sun} />
      <View style={glyph.mountain} />
    </View>
  );
}

export default function IdCameraScreen({ onCaptured, onClose }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>('id');
  const insets = useSafeAreaInsets();

  const spec = DOC_SPECS[docType];

  async function capture() {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!pic?.uri) throw new Error('No photo captured');
      onCaptured({
        uri: pic.uri,
        mimeType: pic.format === 'png' ? 'image/png' : 'image/jpeg',
        fileName: `${spec.fileLabel}.${pic.format ?? 'jpg'}`,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not take the photo');
      setBusy(false);
    }
  }

  async function fromGallery() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const asset = await pickIdImage();
      if (!asset) {
        setBusy(false); // user cancelled — stay on the camera
        return;
      }
      onCaptured(asset);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open the gallery');
      setBusy(false);
    }
  }

  // --- Permission gates ---------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Hoppy uses the camera to take a clear photo of your ID and fill your EU forms for you.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permSecondary} onPress={fromGallery} activeOpacity={0.7}>
          <Text style={styles.permSecondaryText}>Choose from gallery instead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permSecondary} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.permSecondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Camera + overlay ---------------------------------------------------
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Top scrim with the instruction */}
      <View style={[styles.topScrim, { paddingTop: insets.top + 8, flex: spec.topFlex }]}>
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 6 }]} onPress={onClose} activeOpacity={0.7} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{spec.title}</Text>
      </View>

      {/* Middle row: side scrims + transparent document window */}
      <View style={[styles.middleRow, { height: spec.height }]}>
        <View style={styles.sideScrim} />
        <View style={[styles.window, { width: spec.width, height: spec.height }]}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <View style={styles.sideScrim} />
      </View>

      {/* Bottom scrim: doc-type toggle + tips + controls */}
      <View style={[styles.bottomScrim, { paddingBottom: insets.bottom + 18, flex: spec.bottomFlex }]}>
        <View style={styles.docToggle}>
          <TouchableOpacity
            style={[styles.docTab, docType === 'id' && styles.docTabActive]}
            onPress={() => setDocType('id')}
            activeOpacity={0.85}
            disabled={busy}
          >
            <Text style={[styles.docTabText, docType === 'id' && styles.docTabTextActive]}>
              ID card
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.docTab, docType === 'a4' && styles.docTabActive]}
            onPress={() => setDocType('a4')}
            activeOpacity={0.85}
            disabled={busy}
          >
            <Text style={[styles.docTabText, docType === 'a4' && styles.docTabTextActive]}>
              A4 document
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{spec.hint}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={fromGallery}
            activeOpacity={0.8}
            disabled={busy}
          >
            <GalleryGlyph />
            <Text style={styles.galleryLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={capture}
            activeOpacity={0.8}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#0A0F1E" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>

          {/* Spacer to keep the shutter centred */}
          <View style={styles.controlSpacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#05070F', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },

  topScrim: {
    backgroundColor: SCRIM,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '600', lineHeight: 20 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },

  middleRow: { flexDirection: 'row' }, // height set inline per doc type
  sideScrim: { flex: 1, backgroundColor: SCRIM },
  window: { borderRadius: 14, overflow: 'hidden' }, // width/height set inline per doc type

  corner: { position: 'absolute', width: 30, height: 30, borderColor: ACCENT },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },

  bottomScrim: {
    backgroundColor: SCRIM,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  docToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  docTab: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9,
  },
  docTabActive: { backgroundColor: ACCENT },
  docTabText: { color: '#CBD5E1', fontSize: 13.5, fontWeight: '700' },
  docTabTextActive: { color: '#0A0F1E' },

  hint: { color: '#CBD5E1', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  error: { color: '#FF9E8E', fontSize: 13, textAlign: 'center', marginTop: 8, fontWeight: '600' },

  controls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  galleryBtn: {
    width: 64, alignItems: 'center', justifyContent: 'center',
  },
  galleryLabel: { color: '#CBD5E1', fontSize: 11, marginTop: 5, fontWeight: '600' },
  controlSpacer: { width: 64 },

  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  // Permission screen
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  permBody: { color: '#AEB6CC', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  permBtn: {
    backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  permBtnText: { color: '#0A0F1E', fontSize: 16, fontWeight: '800' },
  permSecondary: { paddingVertical: 12, marginTop: 4 },
  permSecondaryText: { color: '#8E93EC', fontSize: 14, fontWeight: '600' },
});

// Drawn gallery glyph parts.
const glyph = StyleSheet.create({
  frame: {
    width: 30, height: 26, borderRadius: 6, borderWidth: 2.2, borderColor: '#fff',
    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sun: {
    position: 'absolute', top: 4, right: 5, width: 6, height: 6, borderRadius: 3,
    backgroundColor: ACCENT,
  },
  mountain: {
    position: 'absolute', bottom: -2, left: 3,
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fff',
  },
});
