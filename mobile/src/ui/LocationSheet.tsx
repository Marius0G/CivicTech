// LocationSheet — frosted bottom-sheet city picker (DS overlay/Sheet + LocationSheet screen).
// Lets the user pick where they are; the chosen label drives the home pill.

import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Icon from './Icon';
import { colors, fonts, radius, space } from '../theme';

const CITIES = [
  'Bucharest, Romania', 'Cluj-Napoca, Romania', 'Paris, France', 'Berlin, Germany',
  'Madrid, Spain', 'Barcelona, Spain', 'Rome, Italy', 'Milan, Italy', 'Amsterdam, Netherlands',
  'Brussels, Belgium', 'Vienna, Austria', 'Lisbon, Portugal', 'Warsaw, Poland', 'Kraków, Poland',
  'Athens, Greece', 'Dublin, Ireland', 'Stockholm, Sweden', 'Copenhagen, Denmark',
  'Prague, Czechia', 'Budapest, Hungary', 'Sofia, Bulgaria', 'Helsinki, Finland',
];

interface Props {
  visible: boolean;
  current: string;
  onSelect: (city: string) => void;
  onUseCurrent?: () => void;
  onClose: () => void;
}

export default function LocationSheet({ visible, current, onSelect, onUseCurrent, onClose }: Props) {
  const [q, setQ] = useState('');
  const list = useMemo(
    () => (q ? CITIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())) : CITIES),
    [q]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>Location</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Icon name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={colors.textTertiary} weight="regular" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a city"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="words"
          />
        </View>

        {!!onUseCurrent && (
          <Pressable style={styles.currentRow} onPress={() => { onUseCurrent(); onClose(); }}>
            <Icon name="map-pin" size={18} color={colors.primary} weight="fill" />
            <Text style={styles.currentText}>Use my current location</Text>
          </Pressable>
        )}

        <Text style={styles.eyebrow}>LOCATIONS</Text>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {list.map((c) => {
            const active = c === current;
            return (
              <Pressable key={c} style={styles.row} onPress={() => { onSelect(c); onClose(); }}>
                <Text style={[styles.rowText, active && styles.rowActive]} numberOfLines={1}>{c}</Text>
                {active && <Icon name="check" size={16} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.surfaceScrim },
  sheet: {
    backgroundColor: colors.surfaceCard, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.s5, paddingBottom: space.s8, paddingTop: space.s2, maxHeight: '78%',
    borderTopWidth: 1, borderColor: colors.borderSubtle,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.s3 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s3 },
  title: { color: colors.textPrimary, fontFamily: fonts.sansExtrabold, fontSize: 20 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.s2, height: 48, paddingHorizontal: space.s4,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 15, padding: 0 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s4 },
  currentText: { color: colors.textPrimary, fontFamily: fonts.sansSemibold, fontSize: 16 },
  eyebrow: {
    color: colors.textTertiary, fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6,
    paddingTop: space.s2, paddingBottom: space.s1, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space.s3, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  rowText: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: 16 },
  rowActive: { color: colors.primary, fontFamily: fonts.sansBold },
});
