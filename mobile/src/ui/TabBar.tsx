// TabBar — frosted bottom navigation with a raised golden center Pip button (DS navigation/TabBar).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow, space } from '../theme';
import Icon, { IconName } from './Icon';
import Mascot from '../Mascot';

export type TabKey = 'home' | 'docs' | 'chat' | 'profile';

const ITEMS: { key: TabKey; labelKey: string; icon: IconName }[] = [
  { key: 'home', labelKey: 'tabbar.homeLabel', icon: 'house' },
  { key: 'docs', labelKey: 'tabbar.docsLabel', icon: 'folder' },
  { key: 'chat', labelKey: 'tabbar.pipLabel', icon: 'chat' }, // raised center → Mascot
  { key: 'profile', labelKey: 'tabbar.meLabel', icon: 'user' },
];

export default function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: space.s3 + insets.bottom }]}>
      {ITEMS.map((it) => {
        const isActive = active === it.key;
        if (it.key === 'chat') {
          return (
            <Pressable key={it.key} onPress={() => onChange(it.key)} style={styles.center}>
              <View style={[styles.fab, shadow.primary]}>
                <Mascot speaking={false} celebrate={false} size={40} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{t(it.labelKey)}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={styles.item}>
            <Icon name={it.icon} size={24} color={isActive ? colors.primary : colors.textTertiary} weight={isActive ? 'fill' : 'regular'} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{t(it.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around',
    paddingTop: space.s2,
    paddingHorizontal: space.s3,
    backgroundColor: colors.surfaceFrost, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: space.s1 },
  center: { flex: 1, alignItems: 'center', gap: 3 },
  fab: {
    width: 56, height: 56, borderRadius: 28, marginTop: -28,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.surfacePage, overflow: 'hidden',
  },
  label: { color: colors.textTertiary, fontFamily: fonts.sansSemibold, fontSize: 11 },
  labelActive: { color: colors.primary },
});
