import { View, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useColors, DOMAIN_GRADIENTS, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET } from '@/theme/motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Caption } from '@/components/ui/Typography';

const LEVEL_VALUES: Record<string, number> = {
  none: 0, beginner: 25, intermediate: 50, advanced: 75, expert: 100,
};

interface SkillGap {
  skill: string;
  currentLevel: string;
  requiredLevel: string;
  priority: number;
}

interface SkillGapChartProps {
  gaps: SkillGap[];
}

export function SkillGapChart({ gaps }: SkillGapChartProps) {
  const c = useColors();
  const styles = makeStyles(c);
  return (
    <View style={styles.container}>
      {gaps.map((gap, i) => {
        const current = LEVEL_VALUES[gap.currentLevel] ?? 0;
        const required = LEVEL_VALUES[gap.requiredLevel] ?? 100;

        return (
          <Animated.View key={gap.skill} entering={FadeInRight.delay(i * 100).duration(MOTION_BUDGET.reveal)} style={styles.row}>
            <View style={styles.labelCol}>
              <Body style={styles.skillName}>{gap.skill}</Body>
              <Caption>{gap.currentLevel} → {gap.requiredLevel}</Caption>
            </View>
            <View style={styles.barCol}>
              <ProgressBar value={current} color={c.career} gradientColors={DOMAIN_GRADIENTS.career} height={6} />
              <View style={[styles.requiredMarker, { left: `${required}%` }]} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  labelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  barCol: {
    position: 'relative',
  },
  requiredMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: colors.error,
    borderRadius: 1,
  },
});
