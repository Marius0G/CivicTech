// EU Youth Buddy — "Golden Hour" themed app (design system 665b0df4).
//
// Navigator shell: a mocked EU ID login, then a tab-based app (Home Pip-hub, Docs, Pip chat,
// Profile) matching the design screenshots. The voice/autopilot/RAG engine is unchanged — the
// big mic on Home starts the conversation, and the official form "browser" (Erasmus helper)
// only pops up when the voice agent opens a form.
//
// Requires a DEV CLIENT (react-native-webrtc + expo-linear-gradient), not Expo Go.

import React, { useEffect, useRef, useState } from 'react';
import { View, StatusBar, Platform, PermissionsAndroid, Modal, Animated, StyleSheet, Dimensions } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  useFonts,
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { connectRealtime, RealtimeHandle, FunctionCall } from './src/realtime';
import { useTranslation } from 'react-i18next';
import { ESC_ELIGIBILITY_URL, executeTool, ToolContext } from './src/tools';
import { BACKEND_URL, USE_CACHED_FORM, LIVE_FORM_TIMEOUT_MS } from './src/config';
import { loadSavedLanguage } from './src/i18n';
import { uploadIdImage, saveProfile, pickIdImage, PickedImage, ExtractedProfile } from './src/profileUpload';
import { detectCity } from './src/location';
import { setupNotificationListeners, getPushToken } from './src/notifications';
import IdCameraScreen from './src/IdCameraScreen';
import IdProcessingScreen from './src/IdProcessingScreen';
import IdReviewScreen from './src/IdReviewScreen';
import LoginScreen from './src/LoginScreen';
import Mascot from './src/Mascot';
import { MASCOT_HERO_SIZE, MASCOT_DOCK_SIZE } from './src/mascotProps';
import { Rect } from './src/ui/Anchor';
import GradientBackground from './src/ui/GradientBackground';
import TabBar, { TabKey } from './src/ui/TabBar';
import LocationSheet from './src/ui/LocationSheet';
import MainScreen, { ToolEvent } from './src/screens/MainScreen';
import ChatScreen from './src/screens/ChatScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import DocsScreen from './src/screens/DocsScreen';
import UploadScreen from './src/screens/UploadScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ErasmusHelperScreen from './src/screens/ErasmusHelperScreen';

type Screen = 'home' | 'discover' | 'community' | 'docs' | 'upload' | 'chat' | 'profile';

// Full window height — the agent canvas slides in from below this.
const WINDOW_H = Dimensions.get('window').height;

// Bundled offline snapshot of the ESC eligibility form (metro.config.js bundles .html). The
// autopilot fills it identically — injection targets the same element IDs as the live page.
// Typed loosely because WebView's `source` accepts a required-asset module id at runtime.
const CACHED_FORM: any = require('./assets/eligibility.html');

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS prompts via getUserMedia
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    { title: 'Microphone', message: 'Hoppy needs your mic to talk with you.', buttonPositive: 'OK' }
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

// SafeAreaProvider must wrap the whole tree (incl. the splash + login early returns) so every
// screen can read the real status-bar / nav-bar insets via useSafeAreaInsets() — essential under
// Android edge-to-edge (SDK 56 / new arch), where StatusBar.currentHeight is unreliable.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
  });
  const { t, i18n } = useTranslation();

  const webRef = useRef<WebView>(null);
  const voiceRef = useRef<RealtimeHandle | null>(null);
  // Pending WebView injections, keyed by requestId, resolved by onMessage.
  const pendingRef = useRef<Map<string, (msg: any) => void>>(new Map());
  const reqCounter = useRef(0);

  const [formUrl, setFormUrl] = useState(ESC_ELIGIBILITY_URL);
  // Demo-day safety: when true the WebView loads the bundled cached form instead of the live site.
  // Starts from the config kill-switch; also flips on automatically if the live load errors/times out.
  const [useCachedForm, setUseCachedForm] = useState(USE_CACHED_FORM);
  // Watchdog: if the live form hasn't finished loading in time, fall back to the cached copy.
  const liveFormTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Agent canvas (the Erasmus-helper "browser"): `mounted` keeps it in the tree during the
  // slide-out so the close animation can finish; `open` drives the direction of both animations.
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  // Measured window rects of the two Mascot slots — App flies ONE persistent Mascot between them.
  const [homeAnchor, setHomeAnchor] = useState<Rect | null>(null);
  const [dockAnchor, setDockAnchor] = useState<Rect | null>(null);
  // 0 = frog centered on Home (hero) · 1 = frog docked in the canvas (in control).
  const controlProgress = useRef(new Animated.Value(0)).current;
  // 0 = canvas off-screen below · 1 = canvas fully up.
  const canvasProgress = useRef(new Animated.Value(0)).current;
  const [voiceStatus, setVoiceStatus] = useState(() => i18n.t('app.tapMicPrompt'));
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastTool, setLastTool] = useState('');
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const toolCounter = useRef(0);
  const [location, setLocation] = useState(() => i18n.t('app.locating'));
  const [locationOpen, setLocationOpen] = useState(false);
  const [profile, setProfile] = useState<ExtractedProfile | null>(null);
  // ID scan flow: idle → camera → processing → review (edit) → save commits, cancel discards.
  const [scanStep, setScanStep] = useState<'idle' | 'camera' | 'processing' | 'review'>('idle');
  const [draft, setDraft] = useState<ExtractedProfile | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  // One-shot mascot gestures (Nod/Sad/Point/Poke): bump nonce to (re)fire the named clip.
  const [gesture, setGesture] = useState<{ name: string; nonce: number } | undefined>();
  const gestureNonce = useRef(0);
  // Mocked EU ID gate: the app starts on the LoginScreen until signed in (eID or guest).
  const [authed, setAuthed] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const speakOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live 0..1 voice loudness from getStats(); drives the mascot jaw for real lip-sync. Held as an
  // Animated.Value (not state) so 20fps updates never re-render the tree.
  const levelValue = useRef(new Animated.Value(0)).current;

  // Detect the user's city from their IP (no native module / permission needed). Manual override
  // via the location picker. Shows "Locating…" while it resolves; on a total miss falls back to a
  // tappable "Set location" hint (the pill opens the picker) rather than guessing a wrong city.
  async function detectLocation() {
    setLocation(t('app.locating'));
    const found = await detectCity();
    setLocation(found ? found.label : t('app.setLocation'));
  }

  // On first mount: restore the saved UI language, pull the active profile (drives the greeting
  // name) and detect location.
  useEffect(() => {
    loadSavedLanguage();
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/docs/profile`);
        const j = await r.json();
        if (j?.profile) setProfile(j.profile);
      } catch { /* offline — greet without a name */ }
    })();
    detectLocation();
  }, []);

  // Set up notification listeners on mount
  useEffect(() => {
    const cleanup = setupNotificationListeners(
      (notification) => {
        // Handle notification received while app is in foreground
        console.log('Notification received:', notification);
      },
      (notification) => {
        // Handle notification tapped by user
        console.log('Notification tapped:', notification);
      }
    );

    // Get and log the push token for server-side notifications
    (async () => {
      const token = await getPushToken();
      if (token) {
        console.log('Push token:', token);
        // Store or send this token to your backend for push notifications
      }
    })();

    return cleanup;
  }, []);

  // Hoppy's "talking" state: any speech signal keeps it alive; a quiet gap turns it off.
  function pingSpeaking() {
    setSpeaking(true);
    if (speakOffTimer.current) clearTimeout(speakOffTimer.current);
    speakOffTimer.current = setTimeout(() => setSpeaking(false), 700);
  }
  function stopSpeaking() {
    if (speakOffTimer.current) clearTimeout(speakOffTimer.current);
    setSpeaking(false);
  }
  function triggerCelebrate() {
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2600);
  }
  // Fire a one-shot mascot gesture clip (Nod/Sad/Point/Poke/Wave…).
  function fireGesture(name: string) {
    setGesture({ name, nonce: ++gestureNonce.current });
  }

  // --- Agent canvas slide-up + persistent-Mascot descent ---
  // Pip "takes control": the canvas springs up from the bottom while the ONE Mascot glides from
  // the Home hero down into the canvas dock (no hard screen swap). Reverses on close.
  function openCanvas(url: string) {
    setFormUrl(url);
    setScreen('home');
    setCanvasMounted(true);
    setCanvasOpen(true);
    fireGesture('Point'); // Pip points at the form it's about to coach you through
  }
  function closeCanvas() {
    setCanvasOpen(false);
  }

  // Slide the canvas. After a completed slide-out, unmount it so the WebView is freed.
  useEffect(() => {
    const anim = Animated.spring(canvasProgress, {
      toValue: canvasOpen ? 1 : 0,
      useNativeDriver: true, damping: 20, stiffness: 120, mass: 0.9,
    });
    anim.start(({ finished }) => { if (finished && !canvasOpen) setCanvasMounted(false); });
    return () => anim.stop();
  }, [canvasOpen, canvasProgress]);

  // Fly the frog to the dock only once the canvas is open AND the dock slot is measured (so the
  // target is real); otherwise glide it back to the Home hero.
  useEffect(() => {
    const anim = Animated.spring(controlProgress, {
      toValue: canvasOpen && dockAnchor ? 1 : 0,
      useNativeDriver: true, damping: 18, stiffness: 140, mass: 0.9,
    });
    anim.start();
    return () => anim.stop();
  }, [canvasOpen, dockAnchor, controlProgress]);

  // Live-form watchdog: when the canvas opens against the live site, give it LIVE_FORM_TIMEOUT_MS
  // to finish loading; if it doesn't (slow/flaky Wi-Fi), swap to the bundled cached form so the
  // autopilot can still run. onLoadEnd clears the timer; onError/onHttpError flip immediately.
  useEffect(() => {
    if (canvasMounted && !useCachedForm) {
      liveFormTimer.current = setTimeout(() => setUseCachedForm(true), LIVE_FORM_TIMEOUT_MS);
      return () => { if (liveFormTimer.current) { clearTimeout(liveFormTimer.current); liveFormTimer.current = null; } };
    }
  }, [canvasMounted, useCachedForm]);

  // --- WebView injection with async result correlation ---
  function injectAndWait(js: string, requestId: string): Promise<any> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingRef.current.delete(requestId);
        resolve({ result: { ok: false, errors: ['webview timeout'] } });
      }, 8000);
      pendingRef.current.set(requestId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      webRef.current?.injectJavaScript(js);
    });
  }

  function onMessage(e: WebViewMessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      pendingRef.current.get(msg.requestId)!(msg);
      pendingRef.current.delete(msg.requestId);
    }
  }

  // --- Tool routing context ---
  const toolCtx: ToolContext = {
    backendUrl: BACKEND_URL,
    newRequestId: () => `r${++reqCounter.current}`,
    // A form is requested by the agent → slide the canvas up and dock the frog.
    openForm: async (url: string) => { openCanvas(url); },
    injectAndWait,
    callServerTool: async (name, args) => {
      const res = await fetch(`${BACKEND_URL}/tools/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {}),
      });
      return res.json();
    },
  };

  // Short human detail for a tool-call card (kept tiny — these render in small cards).
  function toolDetail(name: string, args: any): string | undefined {
    if (name === 'search_eu_info' || name === 'web_search') return args?.query;
    if (name === 'open_form') { try { return new URL(args?.url).host; } catch { return undefined; } }
    if (name === 'fill_form') return 'from your saved profile';
    return undefined;
  }

  async function handleFunctionCall(call: FunctionCall) {
    let args: any = {};
    try { args = JSON.parse(call.arguments || '{}'); } catch { /* keep {} */ }
    setLastTool(`${call.name}…`);
    // Surface the tool call as a live card.
    const evId = `t${++toolCounter.current}`;
    setToolEvents((prev) => [
      ...prev,
      { id: evId, name: call.name, detail: toolDetail(call.name, args), status: 'running' as const },
    ].slice(-20));
    try {
      const output = await executeTool(call.name, args, toolCtx);
      setLastTool(`${call.name} → ${output.slice(0, 80)}`);
      setToolEvents((prev) => prev.map((e) => (e.id === evId ? { ...e, status: 'done' as const } : e)));
      // Celebrate the moment the form is successfully filled; otherwise a quick acknowledging nod.
      if (call.name === 'fill_form') {
        try { if (JSON.parse(output)?.ok) triggerCelebrate(); else fireGesture('Nod'); } catch { fireGesture('Nod'); }
      } else {
        fireGesture('Nod');
      }
      voiceRef.current?.sendToolResult(call.call_id, output);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setLastTool(`⚠ ${call.name}: ${msg.slice(0, 80)}`);
      setToolEvents((prev) => prev.map((e) => (e.id === evId ? { ...e, status: 'error' as const } : e)));
      fireGesture('Sad'); // honest "oops" when a tool fails
      voiceRef.current?.sendToolResult(call.call_id, JSON.stringify({ error: msg }));
    }
  }

  // Open the custom ID camera. The capture (or gallery pick) comes back via handleIdCaptured.
  function handleScanCamera() {
    if (scanStep !== 'idle') return;
    setReviewError(null);
    setScanStep('camera');
  }

  // "Browse files" — pick from the gallery, then run the same extract → review flow.
  async function handleBrowse() {
    if (scanStep !== 'idle') return;
    try {
      const asset = await pickIdImage();
      if (asset) await handleIdCaptured(asset);
    } catch (e: any) {
      setVoiceStatus(t('app.pickFailed', { error: e.message ?? e }));
    }
  }

  // Got an image (camera or gallery) — show "Processing…", extract the fields, then let the
  // user review/edit them. Nothing is saved server-side yet (that happens on Save).
  async function handleIdCaptured(img: PickedImage) {
    setScanStep('processing');
    setVoiceStatus(t('app.readingId'));
    try {
      const res = await uploadIdImage(img);
      // Show the raw vision read (country as a name) for the user to confirm/correct.
      setDraft(res.extracted);
      setReviewError(null);
      setScanStep('review');
    } catch (e: any) {
      setScanStep('idle');
      setVoiceStatus(t('app.scanFailed', { error: e.message ?? e }));
    }
  }

  // User tapped Save in the review screen — commit the confirmed profile, then close the flow.
  async function handleSaveProfile(edited: ExtractedProfile) {
    setReviewSaving(true);
    setReviewError(null);
    try {
      const saved = await saveProfile(edited);
      setProfile(saved);
      setScanStep('idle');
      setDraft(null);
      setVoiceStatus(t('app.gotItNamed', { name: saved.name || t('app.friend') }));
    } catch (e: any) {
      setReviewError(t('app.couldNotSave', { error: e.message ?? e }));
    } finally {
      setReviewSaving(false);
    }
  }

  // Cancel discards the scan without saving anything.
  function handleCancelReview() {
    setScanStep('idle');
    setDraft(null);
    setReviewError(null);
  }

  async function toggleVoice() {
    if (connecting) return; // ignore taps mid-connect
    if (connected) {
      voiceRef.current?.stop();
      voiceRef.current = null;
      setConnected(false);
      stopSpeaking();
      setVoiceStatus(t('app.tapToTalkAgain'));
      return;
    }
    try {
      if (!(await ensureMicPermission())) {
        setVoiceStatus(t('app.micDenied'));
        return;
      }
      setConnecting(true);
      setToolEvents([]); // fresh session
      voiceRef.current = await connectRealtime({
        onStatus: setVoiceStatus,
        onFunctionCall: handleFunctionCall,
        onSpeakingChange: (sp) => (sp ? pingSpeaking() : stopSpeaking()),
        onAudioPulse: pingSpeaking,
        onLevel: (l) => levelValue.setValue(l),
        language: i18n.language, // Hoppy greets/answers in the user's chosen language
      });
      setConnected(true);
    } catch (e: any) {
      setVoiceStatus(`${e.message ?? e}`);
    } finally {
      setConnecting(false);
    }
  }

  function logout() {
    if (connected) { voiceRef.current?.stop(); voiceRef.current = null; setConnected(false); }
    setConnecting(false);
    setCanvasOpen(false);
    setCanvasMounted(false);
    setToolEvents([]);
    setProfile(null);
    setScreen('home');
    setAuthed(false);
  }

  function handleTab(k: TabKey) {
    setScreen(k === 'chat' ? 'chat' : k);
  }

  const formHost = (() => { try { return new URL(formUrl).host; } catch { return 'europa.eu'; } })();
  const coaching = lastTool
    ? `Hoppy · ${lastTool}`
    : t('app.coachingDefault');
  const firstName = profile?.name ? profile.name.split(/\s+/)[0] : undefined;
  const showTabBar = (screen === 'home' || screen === 'discover' || screen === 'community' || screen === 'docs' || screen === 'profile') && !canvasOpen;
  const tabActive: TabKey = screen === 'upload' ? 'docs' : (screen as TabKey);

  // Persistent-Mascot overlay geometry: the single frog lives in window space and interpolates
  // between the Home hero rect (control 0) and the canvas dock rect (control 1). Scale is around
  // the box centre, so we offset translate by HERO/2 to keep the centre on the measured point.
  const HERO = MASCOT_HERO_SIZE;
  const hx = homeAnchor?.cx ?? 0, hy = homeAnchor?.cy ?? 0;
  const dx = dockAnchor?.cx ?? hx, dy = dockAnchor?.cy ?? hy;
  const frogTx = controlProgress.interpolate({ inputRange: [0, 1], outputRange: [hx - HERO / 2, dx - HERO / 2] });
  const frogTy = controlProgress.interpolate({ inputRange: [0, 1], outputRange: [hy - HERO / 2, dy - HERO / 2] });
  const frogScale = controlProgress.interpolate({ inputRange: [0, 1], outputRange: [1, MASCOT_DOCK_SIZE / HERO] });
  const canvasTy = canvasProgress.interpolate({ inputRange: [0, 1], outputRange: [WINDOW_H, 0] });
  // Show the frog on Home, and the whole time the canvas is mounted (it flies into the dock).
  const showFrog = (screen === 'home' || canvasMounted) && !!homeAnchor;

  // Branded splash while fonts load (no white flash). Proceed anyway if fonts error.
  if (!fontsLoaded && !fontError) {
    return (
      <GradientBackground variant="sunrise">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Mascot speaking={false} celebrate={false} size={132} />
        </View>
      </GradientBackground>
    );
  }

  // Mocked EU ID sign-in gate (Welcome → eID login) before the buddy hub.
  if (!authed) {
    return <LoginScreen onDone={() => { setAuthed(true); setScreen('home'); }} />;
  }

  return (
    <GradientBackground variant="night">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ID scan flow: camera → processing → review/edit. Save commits; cancel discards. */}
      <Modal
        visible={scanStep !== 'idle'}
        animationType="slide"
        onRequestClose={handleCancelReview}
        statusBarTranslucent
      >
        {scanStep === 'camera' && (
          <IdCameraScreen onCaptured={handleIdCaptured} onClose={handleCancelReview} />
        )}
        {scanStep === 'processing' && <IdProcessingScreen />}
        {scanStep === 'review' && draft && (
          <IdReviewScreen
            initial={draft}
            saving={reviewSaving}
            error={reviewError}
            onSave={handleSaveProfile}
            onCancel={handleCancelReview}
          />
        )}
      </Modal>

      {/* Location picker (frosted bottom sheet). */}
      <LocationSheet
        visible={locationOpen}
        current={location}
        onSelect={setLocation}
        onUseCurrent={detectLocation}
        onClose={() => setLocationOpen(false)}
      />

      {/* Active screen */}
      <View style={{ flex: 1 }}>
        {/* Home: the Pip hub. When the agent opens a form, the canvas slides up OVER this and the
            persistent Mascot (below) glides into the canvas dock — no hard swap. */}
        {screen === 'home' && (
          <MainScreen
            name={firstName}
            location={location}
            voiceStatus={voiceStatus}
            connected={connected}
            connecting={connecting}
            toolEvents={toolEvents}
            onToggleVoice={toggleVoice}
            onOpenChat={() => setScreen('chat')}
            onLocation={() => setLocationOpen(true)}
            onHeroAnchor={setHomeAnchor}
            onPokeMascot={() => fireGesture('Poke')}
          />
        )}
        {screen === 'discover' && <DiscoverScreen />}
        {screen === 'community' && <CommunityScreen />}
        {screen === 'chat' && (
          <ChatScreen onBack={() => setScreen('home')} onMic={toggleVoice} />
        )}
        {screen === 'docs' && (
          <DocsScreen onBack={() => setScreen('home')} onUpload={() => setScreen('upload')} />
        )}
        {screen === 'upload' && (
          <UploadScreen
            onBack={() => setScreen('docs')}
            onBrowse={handleBrowse}
            onScanCamera={handleScanCamera}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen onBack={() => setScreen('home')} onLogout={logout} />
        )}
      </View>

      {/* Agent canvas — slides up from the bottom over the active screen. Holds the live WebView
          (App keeps the ref for the autopilot). pointerEvents off while sliding out. */}
      {canvasMounted && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: canvasTy }] }]}
          pointerEvents={canvasOpen ? 'auto' : 'none'}
        >
          <ErasmusHelperScreen
            host={formHost}
            coaching={coaching}
            onClose={closeCanvas}
            onConfirm={closeCanvas}
            onDockAnchor={setDockAnchor}
          >
            <WebView
              ref={webRef}
              source={useCachedForm ? CACHED_FORM : { uri: formUrl }}
              onMessage={onMessage}
              // The live form finished loading — cancel the fallback watchdog.
              onLoadEnd={() => { if (liveFormTimer.current) { clearTimeout(liveFormTimer.current); liveFormTimer.current = null; } }}
              // Hard load failure (DNS, TLS, HTTP error) → use the bundled cached form instead.
              onError={() => setUseCachedForm(true)}
              onHttpError={() => setUseCachedForm(true)}
              javaScriptEnabled
              domStorageEnabled
              style={{ flex: 1, backgroundColor: '#fff' }}
            />
          </ErasmusHelperScreen>
        </Animated.View>
      )}

      {/* Persistent Mascot — ONE instance above everything, flying between hero and dock. Never
          intercepts touches; hidden until the hero slot is measured. */}
      {showFrog && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}>
          <Animated.View
            style={{
              position: 'absolute',
              width: HERO,
              height: HERO,
              transform: [{ translateX: frogTx }, { translateY: frogTy }, { scale: frogScale }],
            }}
          >
            <Mascot
              speaking={speaking}
              celebrate={celebrate}
              gesture={gesture}
              levelValue={levelValue}
              size={HERO}
              activity={
                !connected ? 'idle'
                  : speaking ? 'talking'
                  : toolEvents.some((e) => e.status === 'running') ? 'thinking'
                  : 'listening'
              }
            />
          </Animated.View>
        </Animated.View>
      )}

      {showTabBar && <TabBar active={tabActive} onChange={handleTab} />}
    </GradientBackground>
  );
}
