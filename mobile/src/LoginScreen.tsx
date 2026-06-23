// Mocked "EU ID" sign-in — design-system screens 1 (Welcome) + 2 (EU ID login).
//
// This is a HACKATHON MOCK of eIDAS / EU Login single sign-on: no real national eID
// provider is contacted. It introduces Pip, then shows a credible eID form whose
// "Log in" briefly fakes the national-provider redirect before handing off to the app.
// Source of truth: design 665b0df4 — design_handoff/04_SCREENS.md (LoginScreen step 0/1).

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, StatusBar, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mascot from './Mascot';
import GradientBackground from './ui/GradientBackground';
import Button from './ui/Button';
import Icon, { IconName } from './ui/Icon';
import { colors, fonts, radius, space } from './theme';

interface Props {
  /** Called once the mocked eID sign-in completes (or the user continues as guest). */
  onDone: (mode: 'eid' | 'guest') => void;
}

export default function LoginScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0);

  return step === 0 ? (
    <Welcome onContinue={() => setStep(1)} onGuest={() => onDone('guest')} />
  ) : (
    <EidForm onBack={() => setStep(0)} onLoggedIn={() => onDone('eid')} />
  );
}

/* ---------------- Step 0 · Welcome ---------------- */
function Welcome({ onContinue, onGuest }: { onContinue: () => void; onGuest: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <GradientBackground variant="sunrise">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View style={styles.welcomeBody}>
          <Mascot speaking={false} celebrate={false} size={132} />
          <Text style={styles.welcomeTitle}>Meet Pip</Text>
          <Text style={styles.welcomeSub}>
            Your buddy for life in the EU — grants, Erasmus, housing, and every form in between.
          </Text>
        </View>
        <View style={[styles.welcomeDock, { paddingBottom: space.s6 + insets.bottom }]}>
          <Button
            label="Continue with EU ID"
            variant="primary"
            size="lg"
            block
            glow
            onPress={onContinue}
            left={<Icon name="scan-face" size={20} color={colors.onPrimary} />}
          />
          <Button label="Explore as guest" variant="ghost" size="lg" block onPress={onGuest} />
          <Text style={styles.terms}>By continuing you agree to the EU Youth terms.</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

/* ---------------- Step 1 · EU ID login (mocked SSO) ---------------- */
function EidForm({ onBack, onLoggedIn }: { onBack: () => void; onLoggedIn: () => void }) {
  const [email, setEmail] = useState('lea.muller@eu.id');
  const [password, setPassword] = useState('passport2026');
  const [showPw, setShowPw] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [authing, setAuthing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  // Mocked national-eID redirect: a short delay then straight into the app.
  function logIn() {
    if (authing) return;
    setAuthing(true);
    timer.current = setTimeout(onLoggedIn, 1100);
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
          <Text style={styles.topTitle}>EU ID login</Text>
        </View>

        <View style={styles.formBody}>
          {/* Secure-SSO info alert (centered) */}
          <View style={styles.alert}>
            <View style={styles.alertBadge}><Icon name="shield-check" size={24} color={colors.euBlue} /></View>
            <Text style={styles.alertTitle}>Secure single sign-on</Text>
            <Text style={styles.alertBody}>You'll be redirected to your national eID provider.</Text>
          </View>

          <Field
            label="EU ID email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
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
              <Text style={styles.switchLabel}>Keep me signed in</Text>
            </Pressable>
            <Text style={styles.link}>Forgot?</Text>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.altRow}>
            <View style={styles.altItem}>
              <Button
                label="Biometric"
                variant="ghost"
                block
                onPress={logIn}
                left={<Icon name="fingerprint" size={20} />}
              />
            </View>
            <View style={styles.altItem}>
              <Button
                label="Scan QR"
                variant="ghost"
                block
                onPress={logIn}
                left={<Icon name="qr-code" size={20} />}
              />
            </View>
          </View>
        </View>

        {/* Footer login */}
        <View style={[styles.formFooter, { paddingBottom: space.s6 + insets.bottom }]}>
          {authing ? (
            <View style={styles.authingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.authingText}>Signing in with your national eID…</Text>
            </View>
          ) : (
            <Button label="Log in" variant="primary" size="lg" block glow onPress={logIn} />
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
});
