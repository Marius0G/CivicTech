// Screen 11 · Profile / settings (profilescreen.png) — identity, preferences, logout.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TopBar, { circleBtnStyle } from '../ui/TopBar';
import Avatar from '../ui/Avatar';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Icon, { IconName } from '../ui/Icon';
import LanguageSheet from '../ui/LanguageSheet';
import { LANGUAGES, setLanguage } from '../i18n';
import { colors, fonts, radius, space } from '../theme';
import { getNotificationsEnabled, setNotificationsEnabled } from '../notifications';

function Toggle({ value, onToggle, color }: { value: boolean; onToggle: () => void; color: string }) {
  return (
    <Pressable onPress={onToggle} style={[styles.switch, value && { backgroundColor: color }]}>
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

export default function ProfileScreen({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const [push, setPush] = useState(true);
  const [screen, setScreen] = useState(true);
  const [share, setShare] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  // Load notification preference from storage on mount
  useEffect(() => {
    (async () => {
      const enabled = await getNotificationsEnabled();
      setPush(enabled);
    })();
  }, []);

  // Handle notification toggle with permission request
  const handleNotificationToggle = async () => {
    const newValue = !push;
    setPush(newValue);
    await setNotificationsEnabled(newValue);
  };

  return (
    <View style={styles.safe}>
      <TopBar
        title={t('profile.title')}
        onBack={onBack}
        trailing={<View style={styles.circleBtn}><Icon name="pencil" size={18} /></View>}
      />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Identity */}
        <View style={styles.identity}>
          <Avatar name="Lea Müller" size={76} ring />
          <Text style={styles.name}>Lea Müller</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: 'rgba(91,140,255,0.16)' }]}>
              <Text style={[styles.badgeDot, { color: colors.euBlue }]}>● </Text>
              <Text style={[styles.badgeText, { color: colors.euBlue }]}>{t('profile.euIdVerified')}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.badgeText, { color: colors.golden300 }]}>{t('profile.student')}</Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <Card style={styles.card}>
          <Row
            icon="globe"
            title={t('profile.language')}
            onPress={() => setLangOpen(true)}
            right={<Text style={styles.valueText}>{`${currentLang.flag}  ${currentLang.native} ›`}</Text>}
            divider
          />
          <Row icon="bell" title={t('profile.pushNotifications')} right={<Toggle value={push} onToggle={handleNotificationToggle} color={colors.primary} />} divider />
          <Row icon="robot" title={t('profile.letPipSeeScreen')} right={<Toggle value={screen} onToggle={() => setScreen((v) => !v)} color={colors.euBlue} />} divider />
          <Row icon="database" title={t('profile.shareAnonymousData')} right={<Toggle value={share} onToggle={() => setShare((v) => !v)} color={colors.twilight500} />} />
        </Card>

        <Card style={styles.card}>
          <Row icon="shield" title={t('profile.privacyData')} right={<Icon name="chevron-right" size={18} color={colors.textTertiary} />} divider />
          <Row icon="help" title={t('profile.helpSupport')} right={<Icon name="chevron-right" size={18} color={colors.textTertiary} />} />
        </Card>

        <Button
          label={t('profile.logOut')}
          variant="ghost"
          block
          onPress={onLogout}
          left={<Icon name="log-out" size={18} color={colors.danger} />}
          style={styles.logout}
        />
      </ScrollView>

      <LanguageSheet
        visible={langOpen}
        current={i18n.language}
        onSelect={(code) => setLanguage(code)}
        onClose={() => setLangOpen(false)}
      />
    </View>
  );
}

function Row({
  icon, title, right, divider, onPress,
}: { icon: IconName; title: string; right: React.ReactNode; divider?: boolean; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.rowIcon}><Icon name={icon} size={20} color={colors.textSecondary} weight="regular" /></View>
      <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
      {right}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={[styles.row, divider && styles.rowDivider]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, divider && styles.rowDivider]}>{content}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  circleBtn: circleBtnStyle,
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s4 },

  identity: { alignItems: 'center', gap: space.s2, paddingVertical: space.s2 },
  name: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 18, marginTop: space.s1 },
  badges: { flexDirection: 'row', gap: space.s2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: space.s3, paddingVertical: 5 },
  badgeDot: { fontSize: 8 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 12 },

  card: { paddingHorizontal: space.s4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3, minHeight: 52 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  rowIcon: { width: 24, alignItems: 'center' },
  rowTitle: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 16 },
  valueText: { color: colors.textTertiary, fontFamily: fonts.sansMedium, fontSize: 14 },
  chevron: { color: colors.textTertiary, fontSize: 20 },

  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.night600, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },

  logout: { borderColor: 'rgba(255,83,82,0.5)', marginTop: space.s1 },
});
