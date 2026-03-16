import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Label, Caption } from '@/components/ui/Typography';

interface DomainScore {
  key: string;
  label: string;
  color: string;
  score: number;
}

interface LifeBalanceDashboardProps {
  scores: {
    goals: number;
    health: number;
    finance: number;
    career: number;
    social: number;
    mind: number;
  };
}

const DOMAINS: { key: keyof LifeBalanceDashboardProps['scores']; label: string; color: string }[] = [
  { key: 'goals', label: 'Goals', color: colors.goal },
  { key: 'health', label: 'Health', color: colors.health },
  { key: 'finance', label: 'Finance', color: colors.finance },
  { key: 'career', label: 'Career', color: colors.career },
  { key: 'social', label: 'Social', color: colors.social },
  { key: 'mind', label: 'Mind', color: colors.polymath },
];

export function LifeBalanceDashboard({ scores }: LifeBalanceDashboardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.container}>
      <View style={styles.header}>
        <Label>Life Balance</Label>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </View>

      {!expanded && (
        <View style={styles.miniRow}>
          {DOMAINS.map((d) => (
            <View key={d.key} style={styles.miniItem}>
              <View style={[styles.miniDot, { backgroundColor: d.color }]} />
              <Caption>{scores[d.key]}</Caption>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.expandedContent}>
          {DOMAINS.map((d, i) => (
            <Animated.View
              key={d.key}
              entering={FadeInDown.delay(i * 100).duration(300)}
              style={styles.domainRow}
            >
              <View style={styles.domainLabel}>
                <View style={[styles.dot, { backgroundColor: d.color }]} />
                <Body style={styles.domainName}>{d.label}</Body>
              </View>
              <View style={styles.barContainer}>
                <ProgressBar value={scores[d.key]} color={d.color} height={6} />
              </View>
              <Caption style={styles.scoreText}>{scores[d.key]}%</Caption>
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  miniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expandedContent: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  domainLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  domainName: {
    fontSize: 13,
  },
  barContainer: {
    flex: 1,
  },
  scoreText: {
    width: 36,
    textAlign: 'right',
  },
});
