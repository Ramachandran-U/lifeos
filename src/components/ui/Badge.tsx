import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Caption } from './Typography';

type BadgeVariant = 'goal' | 'health' | 'finance' | 'career' | 'social' | 'polymath' | 'default';

interface BadgeProps {
  label: string;
  icon?: string;
  variant?: BadgeVariant;
}

export function Badge({ label, icon, variant = 'default' }: BadgeProps) {
  const c = useColors();
  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    goal: { bg: c.goalDim, text: c.goal },
    health: { bg: c.healthDim, text: c.health },
    finance: { bg: c.financeDim, text: c.finance },
    career: { bg: c.careerDim, text: c.career },
    social: { bg: c.socialDim, text: c.social },
    polymath: { bg: c.polymathDim, text: c.polymath },
    default: { bg: c.surface, text: c.textSecondary },
  };
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
