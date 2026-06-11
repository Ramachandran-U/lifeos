import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import type { CrossDisciplineLink } from '@/ai/types';

interface Props {
  link: CrossDisciplineLink | null;
  loading?: boolean;
  pairLabel?: string; // e.g. "AI & ML × Jazz piano"
  onRefresh: () => void;
  onDismiss?: () => void;
}

export function CrossDisciplineCard({ link, loading, pairLabel, onRefresh, onDismiss }: Props) {
  const c = useColors();

  return (
    // Neutral card — domain identity is the R2 eyebrow ink.
    <Card>
      <View style={styles.header}>
        <Label color={c.polymathText}>CROSS-DISCIPLINE</Label>
        <View style={styles.actions}>
          <Pressable onPress={onRefresh} hitSlop={8}>
            <Ionicons name="refresh" size={16} color={c.textMuted} />
          </Pressable>
          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={16} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ marginTop: spacing.sm }}>
          <LoadingDots />
        </View>
      ) : link ? (
        <>
          <Body style={[styles.headline, { color: c.textPrimary }]}>{link.headline}</Body>
          {pairLabel ? (
            <Caption style={{ color: c.textMuted, marginTop: 2 }}>{pairLabel}</Caption>
          ) : null}
          <Body style={[styles.description, { color: c.textSecondary }]}>{link.description}</Body>
          <View style={[styles.starter, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="bulb" size={16} color={c.polymathText} />
            <Body style={{ color: c.textPrimary, flex: 1 }}>{link.starterAction}</Body>
          </View>
        </>
      ) : (
        <Caption style={{ color: c.textMuted, marginTop: spacing.xs }}>
          Add two interests to surface a connection between them.
        </Caption>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  headline: { fontFamily: fonts.heading, fontSize: fontSizes.lg, marginTop: spacing.xs },
  description: { marginTop: spacing.xs },
  starter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
});
