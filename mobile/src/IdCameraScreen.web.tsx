// WEB twin of IdCameraScreen. expo-camera's CameraView doesn't run in a browser, so we use the
// native browser camera: getUserMedia → a <video> live preview (rear camera on mobile) with the
// same framing overlay, and capture by drawing a frame to a <canvas>. If the camera is unavailable
// (desktop / permission denied) we fall back to the file picker (gallery). Hands back the same
// { uri, mimeType, fileName } PickedImage as the native screen.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { pickIdImage, PickedImage } from './profileUpload';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SCRIM = 'rgba(5, 7, 15, 0.82)';
const ACCENT = '#F5C24B';

type DocType = 'id' | 'a4';

const A4_H = Math.round(SCREEN_H * 0.42);
const DOC_SPECS: Record<DocType, { width: number; height: number; title: string; hint: string; fileLabel: string }> = {
  id: {
    width: Math.round(SCREEN_W * 0.86),
    height: Math.round((SCREEN_W * 0.86) / 1.585),
    title: 'Take a photo of your ID card',
    hint: 'Fit the whole card inside the frame. Keep it flat, in good light, sharp and glare-free.',
    fileLabel: 'id',
  },
  a4: {
    width: Math.round(A4_H / 1.414),
    height: A4_H,
    title: 'Take a photo of your document',
    hint: 'Fit the whole A4 page inside the frame. Keep it flat, in good light, sharp and glare-free.',
    fileLabel: 'document',
  },
};

interface Props {
  onCaptured: (img: PickedImage) => void;
  onClose: () => void;
}

export default function IdCameraScreenWeb({ onCaptured, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camFailed, setCamFailed] = useState(false);
  const [docType, setDocType] = useState<DocType>('id');
  const spec = DOC_SPECS[docType];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamReady(true);
      } catch {
        setCamFailed(true); // desktop / denied → offer the file picker instead
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (busy || !video) return;
    setBusy(true);
    setError(null);
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(video, 0, 0, w, h);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Could not capture the photo');
      onCaptured({ uri: URL.createObjectURL(blob), mimeType: 'image/jpeg', fileName: `${spec.fileLabel}.jpg` });
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
        setBusy(false);
        return;
      }
      onCaptured(asset);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open the gallery');
      setBusy(false);
    }
  }

  // The live <video> preview — a raw DOM element (react-native-web renders to the DOM).
  const videoEl = React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    muted: true,
    playsInline: true,
    style: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', background: '#000' },
  });

  // Camera unavailable (desktop / denied): a simple gallery-only fallback.
  if (camFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera unavailable</Text>
        <Text style={styles.permBody}>
          We couldn’t open the camera in this browser. You can still upload a clear photo of your ID.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={fromGallery} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>Choose a photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permSecondary} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.permSecondaryText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill as any}>{videoEl}</View>

      {/* Top scrim + instruction */}
      <View style={[styles.topScrim]}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{spec.title}</Text>
      </View>

      {/* Framing window */}
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

      {/* Bottom scrim: doc toggle + tips + controls */}
      <View style={styles.bottomScrim}>
        <View style={styles.docToggle}>
          <TouchableOpacity style={[styles.docTab, docType === 'id' && styles.docTabActive]} onPress={() => setDocType('id')} disabled={busy} activeOpacity={0.85}>
            <Text style={[styles.docTabText, docType === 'id' && styles.docTabTextActive]}>ID card</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.docTab, docType === 'a4' && styles.docTabActive]} onPress={() => setDocType('a4')} disabled={busy} activeOpacity={0.85}>
            <Text style={[styles.docTabText, docType === 'a4' && styles.docTabTextActive]}>A4 document</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{spec.hint}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.controls}>
          <TouchableOpacity style={styles.galleryBtn} onPress={fromGallery} disabled={busy} activeOpacity={0.8}>
            <Text style={styles.galleryLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shutterOuter} onPress={capture} disabled={busy || !camReady} activeOpacity={0.8}>
            {busy ? <ActivityIndicator color="#0A0F1E" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>
          <View style={styles.controlSpacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#05070F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  topScrim: { backgroundColor: SCRIM, flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 18, paddingHorizontal: 20, paddingTop: 24 },
  closeBtn: { position: 'absolute', left: 16, top: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '600', lineHeight: 20 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },

  middleRow: { flexDirection: 'row' },
  sideScrim: { flex: 1, backgroundColor: SCRIM },
  window: { borderRadius: 14, overflow: 'hidden' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: ACCENT },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },

  bottomScrim: { backgroundColor: SCRIM, flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 },
  docToggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: 4, marginBottom: 14 },
  docTab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9 },
  docTabActive: { backgroundColor: ACCENT },
  docTabText: { color: '#CBD5E1', fontSize: 13.5, fontWeight: '700' },
  docTabTextActive: { color: '#0A0F1E' },

  hint: { color: '#CBD5E1', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  error: { color: '#FF9E8E', fontSize: 13, textAlign: 'center', marginTop: 8, fontWeight: '600' },

  controls: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  galleryBtn: { width: 64, alignItems: 'center', justifyContent: 'center' },
  galleryLabel: { color: '#CBD5E1', fontSize: 11, marginTop: 5, fontWeight: '600' },
  controlSpacer: { width: 64 },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  permBody: { color: '#AEB6CC', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  permBtn: { backgroundColor: ACCENT, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { color: '#0A0F1E', fontSize: 16, fontWeight: '800' },
  permSecondary: { paddingVertical: 12, marginTop: 4 },
  permSecondaryText: { color: '#8E93EC', fontSize: 14, fontWeight: '600' },
});
