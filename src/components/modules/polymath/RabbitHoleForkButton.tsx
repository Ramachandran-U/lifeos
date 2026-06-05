import { Pressable, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Body, Caption } from '@/components/ui/Typography';
import type { ForkState, RabbitHoleDirection } from '@/explore/rabbitHoleTree';

interface Props {
  direction: RabbitHoleDirection;
  hint: string;
  state: ForkState;
  onPress: () => void;
  disabled?: boolean;
}

/** A fork choice. The button self-describes its cost: a ghost fork costs an AI
 * call + a new branch ("● not yet opened"); a realized fork is a free cursor
 * jump ("✓ already explored"). */
export function RabbitHoleForkButton({ direction, hint, state, onPress, disabled }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const isDeeper = direction === 'deeper';
  const realized = state === 'realized';

  const handle = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${isDeeper ? 'Go deeper' : 'Branch sideways'}: ${hint}`}
      style={[
        styles.btn,
        isDeeper ? { backgroundColor: c.polymath + '14', borderColor: c.polymath } : { borderColor: c.border },
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons
        name={isDeeper ? 'arrow-down-circle-outline' : 'git-branch-outline'}
        size={20}
        color={isDeeper ? c.polymath : c.textSecondary}
      />
      <View style={styles.label}>
        <Caption style={{ color: isDeeper ? c.polymath : c.textSecondary, fontFamily: fonts.heading, letterSpacing: 0.5 }}>
          {isDeeper ? 'GO DEEPER' : 'BRANCH SIDEWAYS'}
        </Caption>
        <Body style={{ color: c.textPrimary }} numberOfLines={2}>{hint}</Body>
        <Caption style={{ color: realized ? c.success : c.textMuted }}>
          {realized ? '✓ already explored' : '● not yet opened'}
        </Caption>
      </View>
    </Pressable>
  );
}

const makeStyles = (_c: AppColors) => StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.control,
    minHeight: 56,
  },
  label: { flex: 1, gap: 2 },
  disabled: { opacity: 0.45 },
});
