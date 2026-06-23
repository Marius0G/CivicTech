import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TopBar, { circleBtnStyle } from '../ui/TopBar';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { colors, fonts, radius, space } from '../theme';
import { COMMUNITY_EVENTS, COMMUNITY_GROUPS } from '../mock/community';

export default function CommunityScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.safe}>
      <TopBar
        title={t('community.screenTitle')}
        trailing={(
          <View style={styles.circleBtn}>
            <Icon name="plus" size={18} />
          </View>
        )}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hero}>{t('community.topHeadline')}</Text>

        <Text style={styles.sectionTitle}>{t('community.sectionGroups')}</Text>
        <View style={styles.groupList}>
          {COMMUNITY_GROUPS.map((group) => (
            <Card key={group.title} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={styles.groupIcon}><Icon name={group.icon} size={18} color={colors.primary} /></View>
                <View style={styles.groupMeta}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupMembers}>{group.members}</Text>
                </View>
                <View style={styles.groupStatus}><Text style={styles.groupStatusText}>{group.status}</Text></View>
              </View>
              <Text style={styles.groupSubtitle}>{group.subtitle}</Text>
            </Card>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>{t('community.sectionEvents')}</Text>
        {COMMUNITY_EVENTS.map((event) => (
          <Card key={event.title} style={styles.eventCard}>
            <View style={styles.eventRow}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventAttendees}>{event.attendees}</Text>
            </View>
            <Text style={styles.eventMeta}>{event.date} · {event.location}</Text>
            <Text style={styles.eventDescription}>{event.description}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: space.s4, paddingBottom: space.s8, gap: space.s4 },
  circleBtn: circleBtnStyle,
  hero: {
    color: colors.textPrimary,
    fontFamily: fonts.sansExtrabold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: space.s3,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemibold,
    fontSize: 13,
    marginBottom: space.s2,
    letterSpacing: 0.6,
  },
  sectionMargin: { marginTop: space.s4 },
  groupList: { gap: space.s3 },
  groupCard: { padding: space.s4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginBottom: space.s3 },
  groupIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised,
  },
  groupMeta: { flex: 1 },
  groupTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
  },
  groupMembers: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginTop: 2,
  },
  groupStatus: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.s3,
    paddingVertical: 5,
  },
  groupStatusText: {
    color: colors.primary,
    fontFamily: fonts.sansBold,
    fontSize: 12,
  },
  groupSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  eventCard: { padding: space.s4 },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.s2, marginBottom: space.s2 },
  eventTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemibold,
    fontSize: 16,
    flex: 1,
  },
  eventAttendees: {
    color: colors.textSecondary,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  eventMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginBottom: space.s2,
  },
  eventDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
