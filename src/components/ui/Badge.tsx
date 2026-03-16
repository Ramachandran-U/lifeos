import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Caption } from './Typography';

type BadgeVariant = 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath' | 'default';

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  goal: { bg: colors.goalLight, text: colors.goal },
  health: { bg: colors.healthLight, text: colors.health },
  finance: { bg: colors.financeLight, text: colors.finance },
  career: { bg: colors.careerLight, text: colors.career },
  social: { bg: colors.socialLight, text: colors.social },
  polymath: { bg: colors.polymathLight, text: colors.polymath },
  default: { bg: colors.surface, text: colors.textSecondary },
};

interface BadgeProps {
  label: string;
  icon?: string;
  variant?: BadgeVariant;
}

export function Badge({ label, icon, variant = 'default' }: BadgeProps) {
  const v = variantColors[variant];

  return (
    <View style={[styles.pill, { backgroundColor: v.bg }]}>
      {icon ? <Caption color={v.text}>{icon}</Caption> : null}
      <Caption color={v.text} style={styles.label}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 100,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
