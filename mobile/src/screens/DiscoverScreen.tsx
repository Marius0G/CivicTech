import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import TopBar, { circleBtnStyle } from '../ui/TopBar';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { colors, fonts, space } from '../theme';
import { DISCOVER_CARDS, DISCOVER_TOPICS } from '../mock/discover';

export default function DiscoverScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.safe}>
      <TopBar
        title={t('discover.screenTitle')}
        trailing={(
          <View style={styles.circleBtn}>
            <Icon name="search" size={18} />
          </View>
        )}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hero}>{t('discover.topHeadline')}</Text>

        <Text style={styles.sectionTitle}>{t('discover.sectionTrending')}</Text>
        <View style={styles.cardsRow}>
          {DISCOVER_CARDS.map((item) => (
            <Card key={item.title} style={styles.discoverCard}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Icon name={item.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.badge}>{item.badge}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.description}</Text>
            </Card>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>{t('discover.sectionPrograms')}</Text>
        {DISCOVER_TOPICS.map((topic) => (
          <Card key={topic.title} style={styles.topicCard}>
            <Text style={styles.topicTitle}>{topic.title}</Text>
            <Text style={styles.topicText}>{topic.description}</Text>
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
  cardsRow: { gap: space.s3 },
  discoverCard: { padding: space.s4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s3 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised,
  },
  badge: {
    color: colors.primary,
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansBold,
    fontSize: 16,
    marginBottom: space.s2,
  },
  cardText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  topicCard: { padding: space.s4 },
  topicTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemibold,
    fontSize: 15,
    marginBottom: space.s2,
  },
  topicText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
});
