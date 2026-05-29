import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Heading, Caption } from './Typography';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  /** Domain hue for the icon bubble + CTA. Defaults to the brand primary. */
  accent?: string;
  cta?: { label: string; onPress: () => void; loading?: boolean };
  style?: StyleProp<ViewStyle>;
}

// The single empty-state pattern across the app: an accent-tinted icon bubble,
// a heading, an optional caption, and an optional call-to-action. Replaces the
// ad-hoc icon+text blocks each screen used to hand-roll.
export function EmptyState({ icon, title, caption, accent, cta, style }: EmptyStateProps) {
  const c = useColors();
  const hue = accent ?? c.primary;
  return (
    <View style={[styles.root, style]}>
      <View style={[styles.iconBubble, { backgroundColor: hue + '22' }]}>
        <Ionicons name={icon} size={30} color={hue} />
      </View>
      <Heading style={styles.title}>{title}</Heading>
      {caption ? <Caption style={[styles.caption, { color: c.textMuted }]}>{caption}</Caption> : null}
      {cta ? (
        <Button
          title={cta.label}
          onPress={cta.onPress}
          loading={cta.loading}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { textAlign: 'center' },
  caption: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: spacing.sm },
});
