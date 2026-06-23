// "EU ID" sign-in — design-system screens 1 (Welcome) + 2 (login).
//
// When Supabase is configured (SUPABASE_CONFIGURED) this performs REAL authentication: the
// email/password form signs in (or signs up) against Supabase, and "Explore as guest" opens an
// anonymous Supabase session. The styled "EU ID / secure SSO" chrome is kept from the design —
// it's the same email+password account, presented in the EU-ID look. When Supabase is NOT yet
// configured (placeholder keys) it falls back to the original HACKATHON MOCK (a short fake
// redirect) so the app still runs end-to-end without a project.
//
// Navigation after a real sign-in is driven by App's onAuthStateChange listener (which flips the
// auth gate the moment a session exists); in mock mode we call onDone directly.
// Source of truth: design 665b0df4 — design_handoff/04_SCREENS.md (LoginScreen step 0/1).

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mascot from './Mascot';
import GradientBackground from './ui/GradientBackground';
import Button from './ui/Button';
import Icon, { IconName } from './ui/Icon';
import { colors, fonts, radius, space } from './theme';
import { SUPABASE_CONFIGURED } from './config';
import { signInAsGuest, signInWithEmail, signUpWithEmail } from './supabase';

interface Props {
  /** Mock-mode only: called when the fake sign-in / guest completes. With real Supabase auth,
   *  App's session listener drives navigation instead and this isn't used. */
  onDone: (mode: 'eid' | 'guest') => void;
}

export default function LoginScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0);

  // Guest = an anonymous Supabase session when configured (App's listener then navigates), else
  // the original mock guest hand-off.
  async function handleGuest() {
    if (!SUPABASE_CONFIGURED) return onDone('guest');
    const { error } = await signInAsGuest();
    if (error) {
      Alert.alert(
        'Guest mode unavailable',
        `${error.message}\n\nEnable "Anonymous sign-ins" in Supabase → Authentication → Providers, or sign in with an email instead.`,
      );
    }
  }

  return step === 0 ? (
    <Welcome onContinue={() => setStep(1)} onGuest={handleGuest} />
  ) : (
    <EidForm onBack={() => setStep(0)} onLoggedIn={() => onDone('eid')} />
  );
}

/* ---------------- Step 0 · Welcome ---------------- */
function Welcome({ onContinue, onGuest }: { onContinue: () => void; onGuest: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <GradientBackground variant="sunrise">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View style={styles.welcomeBody}>
          <Mascot speaking={false} celebrate={false} size={132} />
          <Text style={styles.welcomeTitle}>{t('login.meetToby')}</Text>
          <Text style={styles.welcomeSub}>
            {t('login.welcomeSub')}
          </Text>
        </View>
        <View style={[styles.welcomeDock, { paddingBottom: space.s6 + insets.bottom }]}>
          <Button
            label={t('login.continueWithEuId')}
            variant="primary"
            size="lg"
            block
            glow
            onPress={onContinue}
            left={<Icon name="scan-face" size={20} color={colors.onPrimary} />}
          />
          <Button label={t('login.exploreAsGuest')} variant="ghost" size="lg" block onPress={onGuest} />
          <Text style={styles.terms}>{t('login.terms')}</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

/* ---------------- Step 1 · EU ID login ---------------- */
function EidForm({ onBack, onLoggedIn }: { onBack: () => void; onLoggedIn: () => void }) {
  const { t } = useTranslation();
  // Prefill the demo credentials only in mock mode; real auth starts blank.
  const [email, setEmail] = useState(SUPABASE_CONFIGURED ? '' : 'lea.muller@eu.id');
  const [password, setPassword] = useState(SUPABASE_CONFIGURED ? '' : 'passport2026');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPw, setShowPw] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  // Real Supabase sign-in / sign-up. On success, App's onAuthStateChange listener flips the gate
  // and this screen unmounts (we keep the spinner up until then). In mock mode (no Supabase) we
  // fake a brief national-eID redirect and hand off via onLoggedIn.
  async function submit() {
    if (authing) return;
    setError(null);
    setNotice(null);

    if (!SUPABASE_CONFIGURED) {
      setAuthing(true);
      timer.current = setTimeout(onLoggedIn, 1100);
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setAuthing(true);
    try {
      const { data, error: authErr } =
        mode === 'signin'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);
      if (authErr) {
        setError(authErr.message);
        setAuthing(false);
        return;
      }
      // Sign-up with email confirmation returns no session — tell the user to confirm, then sign in.
      if (mode === 'signup' && !data.session) {
        setNotice('Account created — check your email to confirm, then log in.');
        setMode('signin');
        setAuthing(false);
        return;
      }
      // Otherwise a session now exists; the auth listener navigates. Leave the spinner running.
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setAuthing(false);
    }
  }

  return (
    <View style={styles.formRoot}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.flex}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + space.s1 }]}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.topTitle}>{t('login.euIdLogin')}</Text>
        </View>

        <View style={styles.formBody}>
          {/* Secure-SSO info alert (centered) */}
          <View style={styles.alert}>
            <View style={styles.alertBadge}><Icon name="shield-check" size={24} color={colors.euBlue} /></View>
            <Text style={styles.alertTitle}>{t('login.secureSso')}</Text>
            <Text style={styles.alertBody}>{t('login.secureSsoBody')}</Text>
          </View>

          <Field
            label={t('login.euIdEmail')}
            icon="mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label={t('login.password')}
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            rightIcon={showPw ? 'eye-off' : 'eye'}
            onRightPress={() => setShowPw((s) => !s)}
          />

          {/* Keep me signed in · Forgot? */}
          <View style={styles.row}>
            <Pressable style={styles.switchRow} onPress={() => setKeepSignedIn((v) => !v)}>
              <View style={[styles.switch, keepSignedIn && styles.switchOn]}>
                <View style={[styles.knob, keepSignedIn && styles.knobOn]} />
              </View>
              <Text style={styles.switchLabel}>{t('login.keepSignedIn')}</Text>
            </Pressable>
            {/* Sign-in / Sign-up toggle (real auth only). */}
            {SUPABASE_CONFIGURED ? (
              <Pressable onPress={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError(null); setNotice(null); }}>
                <Text style={styles.link}>{mode === 'signin' ? 'Create account' : 'Have an account?'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.link}>{t('login.forgot')}</Text>
            )}
          </View>

          {/* Inline auth feedback. */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

          {/* Mock-only alternative sign-in methods (biometric / QR are not wired to real auth). */}
          {!SUPABASE_CONFIGURED && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>{t('login.orContinueWith')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.altRow}>
                <View style={styles.altItem}>
                  <Button
                    label={t('login.biometric')}
                    variant="ghost"
                    block
                    onPress={submit}
                    left={<Icon name="fingerprint" size={20} />}
                  />
                </View>
                <View style={styles.altItem}>
                  <Button
                    label={t('login.scanQr')}
                    variant="ghost"
                    block
                    onPress={submit}
                    left={<Icon name="qr-code" size={20} />}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Footer login */}
        <View style={[styles.formFooter, { paddingBottom: space.s6 + insets.bottom }]}>
          {authing ? (
            <View style={styles.authingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.authingText}>{t('login.signingIn')}</Text>
            </View>
          ) : (
            <Button
              label={SUPABASE_CONFIGURED && mode === 'signup' ? 'Create account' : t('login.logIn')}
              variant="primary"
              size="lg"
              block
              glow
              onPress={submit}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/* ---------------- tiny labelled input ---------------- */
function Field({
  label, icon, rightIcon, onRightPress, ...input
}: {
  label: string;
  icon: IconName;
  rightIcon?: IconName;
  onRightPress?: () => void;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBox}>
        <Icon name={icon} size={18} color={colors.textTertiary} weight="regular" />
        <TextInput
          style={styles.fieldInput}
          placeholderTextColor={colors.textTertiary}
          {...input}
        />
        {rightIcon ? (
          <Pressable onPress={onRightPress} hitSlop={10}>
            <Icon name={rightIcon} size={18} color={colors.textTertiary} weight="regular" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  btnIcon: { fontSize: 16 },

  // Welcome
  welcomeBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.s8, textAlign: 'center',
  },
  heroHalo: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(0,231,99,0.08)',
  },
  welcomeTitle: {
    color: colors.textPrimary, fontFamily: fonts.display, fontSize: 30,
    letterSpacing: -0.6, marginTop: space.s4, marginBottom: space.s2,
  },
  welcomeSub: {
    color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 15,
    lineHeight: 22, textAlign: 'center', maxWidth: 280,
  },
  welcomeDock: { paddingHorizontal: space.s6, paddingBottom: space.s6, gap: space.s3 },
  terms: {
    color: colors.textTertiary, fontFamily: fonts.sans, fontSize: 12,
    textAlign: 'center', marginTop: space.s1,
  },

  // Form
  formRoot: { flex: 1, backgroundColor: colors.surfacePage },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2,
    paddingHorizontal: space.s4, paddingBottom: space.s2,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  backChevron: { color: colors.textPrimary, fontSize: 22, lineHeight: 24 },
  topTitle: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 24, letterSpacing: -0.4 },

  formBody: { flex: 1, paddingHorizontal: space.s6, paddingTop: space.s2, gap: space.s4 },

  alert: {
    alignItems: 'center', gap: space.s2,
    backgroundColor: 'rgba(91,140,255,0.10)', borderColor: 'rgba(91,140,255,0.22)',
    borderWidth: 1, borderRadius: radius.xl, paddingVertical: space.s5, paddingHorizontal: space.s5,
  },
  alertBadge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(91,140,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: space.s1,
  },
  alertTitle: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 22, textAlign: 'center' },
  alertBody: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 15, textAlign: 'center', lineHeight: 21 },

  fieldLabel: {
    color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 13,
    marginBottom: 6, marginLeft: 2,
  },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2,
    height: 52, paddingHorizontal: space.s4, borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  fieldIcon: { fontSize: 16 },
  fieldInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 15, padding: 0 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  switch: {
    width: 40, height: 24, borderRadius: 12, backgroundColor: colors.night600,
    padding: 3, justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.primary },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end', backgroundColor: colors.onPrimary },
  switchLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 14 },
  link: { color: colors.textLink, fontFamily: fonts.sansSemibold, fontSize: 14 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerLabel: { color: colors.textTertiary, fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 0.6 },

  altRow: { flexDirection: 'row', gap: space.s3 },
  altItem: { flex: 1 },

  formFooter: { paddingHorizontal: space.s6, paddingBottom: space.s6, paddingTop: space.s2 },
  authingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s3,
    height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceRaised,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  authingText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 14 },
  errorText: { color: '#ff6b6b', fontFamily: fonts.sansMedium, fontSize: 13, marginTop: -space.s2 },
  noticeText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: -space.s2 },
});
