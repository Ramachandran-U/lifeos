import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useEffect } from 'react';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CalorieRingProps {
  consumed: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function CalorieRing({ consumed, target, protein, carbs, fat }: CalorieRingProps) {
  const SIZE = 180;
  const STROKE = 14;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const progress = useSharedValue(0);
  const ratio = target > 0 ? consumed / target : 0;

  useEffect(() => {
    progress.value = withTiming(Math.min(ratio, 1.2), { duration: 800 });
  }, [ratio, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const ringColor = ratio > 1.1 ? colors.error : ratio > 0.9 ? colors.warning : colors.health;

  return (
    <View style={styles.container}>
      <View style={styles.ringContainer}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.surface}
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
          <Body style={styles.macroValue}>{Math.round(protein)}g</Body>
        </View>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#4ECDC4' }]} />
          <Caption>Carbs</Caption>
          <Body style={styles.macroValue}>{Math.round(carbs)}g</Body>
        </View>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: '#FFE66D' }]} />
          <Caption>Fat</Caption>
          <Body style={styles.macroValue}>{Math.round(fat)}g</Body>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
