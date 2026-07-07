import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '@/utils/haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { FrontierPickerSheet } from '@/components/modules/polymath/FrontierPickerSheet';
import type { Frontier } from '@/explore/frontier';

interface Props {
  frontier: Frontier;
  onExplore: (frontier: Frontier) => void;
  /**
   * Frontier controls (all optional — legacy call sites render the static
   * card). `onShuffle` re-rolls to a different pair, `onRegenerate` asks for a
   * new take on the same endpoints, `onPickEndpoint` pins a slot to a chosen /
   * custom interest (`null` on slot 'b' = solo mode: explore interestA alone).
   */
  busy?: boolean;
  interestNames?: string[];
  onShuffle?: () => void;
  onRegenerate?: () => void;
  onPickEndpoint?: (slot: 'a' | 'b', name: string | null) => void;
}

/**
 * "The frontier" — the discovery surface of the redesigned Explore tab.
 * Instead of a grid of adjacent topics to add, it shows the single most
 * fertile gap BETWEEN two interests the user already has: the two endpoints
 * with an untraveled edge between them, the insight, and one bridge action.
 * A solo frontier (interestB null) is a gap WITHIN one interest.
 */
export function FrontierCard({
  frontier,
  onExplore,
  busy = false,
  interestNames,
  onShuffle,
  onRegenerate,
  onPickEndpoint,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [pickerSlot, setPickerSlot] = useState<'a' | 'b' | null>(null);
  const interactive = onPickEndpoint !== undefined;
  const solo = frontier.interestB === null;

  const handleExplore = () => {
    haptic.light();
    onExplore(frontier);
  };

  const openPicker = (slot: 'a' | 'b') => {
    if (!interactive || busy) return;
    haptic.light();
    setPickerSlot(slot);
  };

  const endpoint = (slot: 'a' | 'b') => {
    const name = slot === 'a' ? frontier.interestA : frontier.interestB;
    const emptyB = slot === 'b' && name === null;
    return (
      <Pressable
        onPress={() => openPicker(slot)}
        disabled={!interactive || busy}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityLabel={emptyB ? 'Pick a second interest' : `Change interest: ${name ?? ''}`}
        style={[styles.endpoint, { borderColor: c.border, backgroundColor: c.surface }]}
      >
        <Body
          style={[styles.endpointText, { color: emptyB ? c.textMuted : c.textPrimary }]}
          numberOfLines={2}
        >
          {emptyB ? 'On its own' : name}
        </Body>
        {interactive ? <Ionicons name="chevron-down" size={13} color={c.textMuted} /> : null}
      </Pressable>
    );
  };

  return (
    // Neutral card — the polymath ink lives in the eyebrow + mark (R2/R3).
    <Card style={styles.card}>
      {/* Ink + Signal §3.0.7: THE FRONTIER caps eyebrow died in the W4 Explore
          sweep (2026-06-12) — sentence case in bodyMedium instead. */}
      <View style={styles.eyebrowRow}>
        <Ionicons name="git-compare-outline" size={16} color={c.polymathText} />
        <Body style={[styles.eyebrowText, { color: c.polymath }]}>The frontier</Body>
        <View style={styles.headerActions}>
          {onRegenerate ? (
            <Pressable
              onPress={() => { haptic.light(); onRegenerate(); }}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="New take on this gap"
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={busy ? c.textMuted : c.textSecondary} />
            </Pressable>
          ) : null}
          {onShuffle ? (
            <Pressable
              onPress={() => { haptic.light(); onShuffle(); }}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Try a different pair"
              style={styles.iconBtn}
            >
              <Ionicons name="shuffle-outline" size={18} color={busy ? c.textMuted : c.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* The endpoints. Pair mode: two chips with the untraveled edge between
          them. Solo mode: the second chip reads "On its own" (tappable to
          re-pair) when controls are on, and drops entirely when they're off. */}
      <View style={[styles.body, busy && styles.bodyBusy]} pointerEvents={busy ? 'none' : 'auto'}>
        <View style={styles.edgeRow}>
          {endpoint('a')}
          {!solo || interactive ? (
            <View style={styles.gap}>
              <View style={[styles.gapLine, { backgroundColor: c.border }]} />
              <Caption style={[styles.gapMark, { color: c.polymathText, backgroundColor: c.background }]}>
                ?
              </Caption>
            </View>
          ) : null}
          {!solo || interactive ? endpoint('b') : null}
        </View>

        <Heading style={styles.headline}>{frontier.headline}</Heading>
        <Body style={[styles.insight, { color: c.textSecondary }]}>{frontier.insight}</Body>

        <View style={[styles.bridgeBox, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Ionicons name="construct-outline" size={15} color={c.polymath} />
          <Body style={{ color: c.textPrimary, flex: 1 }}>{frontier.bridgeAction}</Body>
        </View>

        <Pressable
          onPress={handleExplore}
          disabled={busy}
          style={[styles.exploreBtn, { backgroundColor: c.polymath }]}
        >
          <Caption style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>
            {solo ? 'Explore this edge' : 'Explore this gap'}
          </Caption>
          <Ionicons name="arrow-forward" size={15} color={c.inkOnColor} />
        </Pressable>
      </View>

      {interactive ? (
        <FrontierPickerSheet
          visible={pickerSlot !== null}
          slot={pickerSlot ?? 'a'}
          current={pickerSlot === 'a' ? frontier.interestA : frontier.interestB}
          otherSelection={pickerSlot === 'a' ? frontier.interestB : frontier.interestA}
          interests={interestNames ?? []}
          onClose={() => setPickerSlot(null)}
          onPick={(name) => {
            const slot = pickerSlot ?? 'a';
            setPickerSlot(null);
            onPickEndpoint?.(slot, name);
          }}
        />
      ) : null}
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrowText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 'auto',
  },
  iconBtn: { padding: spacing.xs },
  body: { gap: spacing.sm },
  // Generation in flight: rest the content, block taps (pointerEvents above).
  bodyBusy: { opacity: 0.4 },
  edgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  endpoint: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  endpointText: { fontFamily: fonts.heading, fontSize: fontSizes.sm, textAlign: 'center', flexShrink: 1 },
  gap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  gapLine: { position: 'absolute', height: 1, left: 0, right: 0 },
  gapMark: { fontFamily: fonts.heading, fontSize: fontSizes.md, paddingHorizontal: 6 },
  headline: { fontSize: fontSizes.lg, color: c.textPrimary, marginTop: spacing.xs },
  insight: { lineHeight: 20 },
  bridgeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    borderWidth: 1, borderRadius: 12, padding: spacing.sm, marginTop: spacing.xs,
  },
  exploreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, marginTop: spacing.xs,
  },
});
