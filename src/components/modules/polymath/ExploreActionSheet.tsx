import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import type { Interest } from '@/db/queries/interests';
import type { ExploreInterestRef } from '@/explore/exploreLaunch';

/**
 * "Explore this" chooser for a single interest:
 *   - DIVE   → go deep on one idea
 *   - BRIDGE → connect it with another interest (reveals an interest picker)
 * Both hand back to the caller, which launches the rabbit hole (useExploreLauncher).
 *
 * Surfaces are ink/neutral (Manifesto): the polymath hue appears only as the R3
 * glyph, never as a coloured selection. Bridge is disabled when there's no second
 * interest to connect to.
 */
interface Props {
  visible: boolean;
  interest: Interest | null;
  /** The user's OTHER active interests (excludes `interest`) — the bridge targets. */
  otherInterests: Interest[];
  onDive: (interest: ExploreInterestRef) => void;
  onBridge: (a: ExploreInterestRef, b: ExploreInterestRef) => void;
  /** Start a 7-step expedition seeded from this interest. */
  onPlan: (interest: ExploreInterestRef) => void;
  /** False when at the active-expedition cap — disables "Plan it". */
  canPlan: boolean;
  onClose: () => void;
}

export function ExploreActionSheet({ visible, interest, otherInterests, onDive, onBridge, onPlan, canPlan, onClose }: Props) {
  const c = useColors();
  const [picking, setPicking] = useState(false); // false = choose Dive/Bridge, true = pick a bridge target

  // Always reopen on the chooser, never mid-bridge from a previous open.
  useEffect(() => {
    if (visible) setPicking(false);
  }, [visible]);

  if (!interest) return null;
  const canBridge = otherInterests.length > 0;

  const tap = () => Haptics.selectionAsync().catch(() => {});

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        {!picking ? (
          <>
            <Heading style={{ color: c.textPrimary, marginBottom: spacing.sm }}>
              Explore {interest.name}
            </Heading>
            <Caption style={{ color: c.textMuted, marginBottom: spacing.md }}>
              Go deep on it on its own, or connect it with another interest.
            </Caption>

            <Pressable
              onPress={() => { tap(); onDive(interest); onClose(); }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel={`Dive into ${interest.name}`}
            >
              <Ionicons name="arrow-down-circle" size={22} color={c.polymath} />
              <View style={styles.rowText}>
                <Body style={{ color: c.textPrimary }}>Dive in</Body>
                <Caption style={{ color: c.textMuted }}>Wander {interest.name} — one idea, all the way down.</Caption>
              </View>
            </Pressable>

            <Pressable
              disabled={!canPlan}
              onPress={() => { tap(); onPlan(interest); onClose(); }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border, opacity: canPlan ? 1 : 0.5 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canPlan }}
              accessibilityLabel={`Make a plan for ${interest.name}`}
            >
              <Ionicons name="map" size={22} color={c.polymath} />
              <View style={styles.rowText}>
                <Body style={{ color: c.textPrimary }}>Plan it</Body>
                <Caption style={{ color: c.textMuted }}>
                  {canPlan ? `A 7-step expedition through ${interest.name}.` : 'Finish an active expedition first.'}
                </Caption>
              </View>
            </Pressable>

            <Pressable
              disabled={!canBridge}
              onPress={() => { tap(); setPicking(true); }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border, opacity: canBridge ? 1 : 0.5 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canBridge }}
              accessibilityLabel={`Bridge ${interest.name} with another interest`}
            >
              <Ionicons name="git-merge" size={22} color={c.polymath} />
              <View style={styles.rowText}>
                <Body style={{ color: c.textPrimary }}>Bridge</Body>
                <Caption style={{ color: c.textMuted }}>
                  {canBridge ? `Connect ${interest.name} with another interest.` : 'Add another interest to bridge.'}
                </Caption>
              </View>
              {canBridge && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={() => { tap(); setPicking(false); }} hitSlop={spacing.sm} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={c.textSecondary} />
              </Pressable>
              <Heading style={{ color: c.textPrimary }}>Connect {interest.name} with…</Heading>
            </View>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {otherInterests.map((other) => (
                <Pressable
                  key={other.id}
                  onPress={() => { tap(); onBridge(interest, other); onClose(); }}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Bridge ${interest.name} with ${other.name}`}
                >
                  <Ionicons name="sparkles" size={20} color={c.polymath} />
                  <View style={styles.rowText}>
                    <Body style={{ color: c.textPrimary }}>{other.name}</Body>
                    <Caption style={{ color: c.textMuted }}>{other.category.toUpperCase()}</Caption>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
  },
});
