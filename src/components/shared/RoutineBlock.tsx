import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';

const MODULE_COLORS: Record<string, string> = {
  goal: colors.goal,
  health: colors.health,
  finance: colors.finance,
  career: colors.career,
  social: colors.social,
  polymath: colors.polymath,
  rest: colors.textMuted,
  work: colors.textSecondary,
  meal: colors.warning,
};

interface RoutineBlockProps {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
  onComplete: (id: string) => void;
}

export function RoutineBlock({ id, startTime, endTime, title, module, status, onComplete }: RoutineBlockProps) {
  const moduleColor = MODULE_COLORS[module] ?? colors.textMuted;
  const isCompleted = status === 'completed';
  const opacity = useSharedValue(isCompleted ? 0.5 : 1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleComplete = () => {
    if (isCompleted) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    opacity.value = withTiming(0.5, { duration: 300 });
    onComplete(id);
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={animatedStyle}>
      <View style={styles.container}>
        <View style={styles.timeCol}>
          <Caption>{startTime}</Caption>
          <Caption>{endTime}</Caption>
        </View>
        <View style={[styles.accent, { backgroundColor: moduleColor }]} />
        <View style={styles.content}>
          <Body style={[styles.title, isCompleted && styles.titleCompleted]}>{title}</Body>
          <Caption style={{ color: moduleColor }}>{module}</Caption>
        </View>
        <Pressable onPress={handleComplete} style={styles.statusButton}>
          {isCompleted ? (
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          ) : (
            <View style={styles.circle} />
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  timeCol: {
    width: 44,
    alignItems: 'center',
  },
  accent: {
    width: 4,
    height: '80%',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  statusButton: {
    padding: spacing.xs,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
