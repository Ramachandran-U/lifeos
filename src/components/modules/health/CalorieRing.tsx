import { View, StyleSheet, Pressable, Linking } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useEffect } from 'react';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET } from '@/theme/motion';
import { Body, Caption, Heading } from '@/components/ui/Typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CalorieRingProps {
  consumed: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional macro goals — when set, each macro renders as "eaten / target g". */
  proteinTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
}

export function CalorieRing({ consumed, target, protein, carbs, fat, proteinTarget, carbsTarget, fatTarget }: CalorieRingProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const SIZE = 180;
  const STROKE = 14;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const progress = useSharedValue(0);
  const ratio = target > 0 ? consumed / target : 0;

  useEffect(() => {
    progress.value = withTiming(Math.min(ratio, 1.2), { duration: MOTION_BUDGET.progressFill });
  }, [ratio, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const ringColor = c.health;

  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={c.surface}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Heading style={styles.calorieCount}>{Math.round(consumed)}</Heading>
          <Caption>/ {target} kcal</Caption>
        </View>
      </View>

      <View style={styles.macros}>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#FF6B6B' }]} />
          <Caption>Protein</Caption>
          <Body style={styles.macroValue}>
            {Math.round(protein)}{proteinTarget ? `/${Math.round(proteinTarget)}` : ''}g
          </Body>
        </View>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#4ECDC4' }]} />
          <Caption>Carbs</Caption>
          <Body style={styles.macroValue}>
            {Math.round(carbs)}{carbsTarget ? `/${Math.round(carbsTarget)}` : ''}g
          </Body>
        </View>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#FFE66D' }]} />
          <Caption>Fat</Caption>
          <Body style={styles.macroValue}>
            {Math.round(fat)}{fatTarget ? `/${Math.round(fatTarget)}` : ''}g
          </Body>
        </View>
      </View>

      <Pressable
        onPress={() => Linking.openURL('https://www.nationaleatingdisorders.org/help-support/contact-helpline').catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel="Eating concerns? Get support"
        hitSlop={8}
      >
        <Caption style={styles.supportLink}>Eating concerns? Get support →</Caption>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  calorieCount: {
    fontSize: fontSizes.xxxl,
    fontFamily: fonts.display,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  macroItem: {
    alignItems: 'center',
    gap: 2,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroValue: {
    fontFamily: fonts.bodyMedium,
  },
  supportLink: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    textDecorationLine: 'underline',
  },
});
