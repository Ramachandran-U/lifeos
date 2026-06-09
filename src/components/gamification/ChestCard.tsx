import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { haptic } from '@/utils/haptics';
import type { ChestRecord } from '@/db/queries/chests';

interface Props {
  chest: ChestRecord;
  onOpen: (chestId: string) => void;
  /** gamification === 'minimal' renders the plain claim row, no theatre. */
  minimal?: boolean;
}

const SOURCE_COPY: Record<string, string> = {
  peak_beat: 'For finishing every block today',
  milestone: 'For a streak milestone',
  quest_sweep: 'For sweeping every quest',
  comeback: 'For coming back',
};

// Variable-reward chest row (variable_rewards_v1). A pending chest WAITS —
// no countdown, no expiry, no urgency styling (ethics: chests only add; the
// user opens it whenever they feel like it). Flat resting state per Aurora
// Refined; the celebration happens in ChestOpenOverlay, not here.
export function ChestCard({ chest, onOpen, minimal = false }: Props) {
  const c = useColors();

  const handleOpen = () => {
    haptic.light();
    onOpen(chest.id);
  };

  if (minimal) {
    return (
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Claim reward chest"
        style={[styles.minimalRow, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <Text style={[styles.minimalText, { color: c.textPrimary }]}>A reward is waiting</Text>
        <Text style={[styles.minimalCta, { color: c.primary }]}>Claim</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleOpen}
      accessibilityRole="button"
      accessibilityLabel="Open reward chest"
      style={[styles.card, { backgroundColor: c.card, borderColor: c.xp + '55' }]}
    >
      <Text style={styles.glyph}>🎁</Text>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: c.textPrimary }]}>A chest is waiting</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {SOURCE_COPY[chest.source] ?? 'You earned this'} · open whenever you like
        </Text>
      </View>
      <View style={[styles.cta, { backgroundColor: c.xp + '1A', borderColor: c.xp + '66' }]}>
        <Text style={[styles.ctaText, { color: c.xp }]}>Open</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  glyph: { fontSize: fontSizes.xxl },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 16 },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  ctaText: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  minimalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
  },
  minimalText: { fontFamily: fonts.body, fontSize: fontSizes.sm },
  minimalCta: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
});
