import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme/colors';
import { fonts, TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Text } from '@/components/ui/Text';
import { Body, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { useHeroSnoozeStore } from '@/store/useHeroSnoozeStore';
import { RELATIONSHIP_META, type Contact, type RelationshipType } from '@/db/queries/social';

interface ReconnectHeroProps {
  /** Head of the most-overdue sort, or null when nobody is overdue. */
  contact: Contact | null;
  /** Days since last contact for `contact` (null only when unknowable). */
  daysSince: number | null;
  /** contacts.length - overdue.length — the quiet-state count. */
  inCadenceCount: number;
  onOpen: (id: string) => void;
  /** Fired after the snooze is recorded — the store call lives in this
   *  component so "Not today" → useHeroSnoozeStore.snooze('social') holds by
   *  construction. Optional: the screen reacts via its store subscription. */
  onSnooze?: () => void;
  /** Empty-state CTA (`Add someone`) — opens the AddContactSheet. */
  onAdd: () => void;
}

// §3.4: 60 days is where "n days ago" stops being legible — switch to months.
const MONTH_SWITCH_DAYS = 60;

/**
 * THE Social hero (Ink + Signal §3.4): the answer is a person, not a score.
 * Three states:
 *  - overdue exists: `{firstName} would love to hear from you.` — compassion
 *    rule: no digits in the h1 and none of overdue/late/neglected/behind/forgot
 *    anywhere; `Say hello` filled social pill + `Not today` quiet snooze
 *  - nobody overdue (rest quiet): a single in-cadence line, no CTA, no rail
 *  - zero contacts: the EmptyState invitation with the on-device trust note
 *
 * Chrome (overdue state): type on the screen background behind a 4px
 * `c.social` left border (structural color, R9 — the hue carries the CTA).
 * No idle motion lives here — the screen owns the one hero-budget entry.
 */
export function ReconnectHero({
  contact,
  daysSince,
  inCadenceCount,
  onOpen,
  onSnooze,
  onAdd,
}: ReconnectHeroProps) {
  const c = useColors();
  const snooze = useHeroSnoozeStore((s) => s.snooze);

  // ── Empty — zero contacts ──────────────────────────────────────────────────
  if (!contact && inCadenceCount <= 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="Build your inner orbit"
        caption={"Add the people you actually want to stay close to.\nWe'll quietly tell you when it's been too long."}
        accent={c.social}
        trustNote="Names stay on this device — nothing is uploaded."
        cta={{ label: 'Add someone', onPress: onAdd }}
      />
    );
  }

  // ── Rest quiet — everyone in cadence ───────────────────────────────────────
  if (!contact) {
    return (
      <View style={styles.quiet}>
        <Text variant="h3">You're in cadence with everyone.</Text>
        <Caption style={[styles.numeric, { color: c.textSecondary }]}>
          {`${inCadenceCount} people in your orbit`}
        </Caption>
      </View>
    );
  }

  // ── Overdue exists — one person, no judgment ───────────────────────────────
  const firstName = contact.name.split(' ')[0];
  const tierLabel =
    RELATIONSHIP_META[contact.relationshipType as RelationshipType]?.label ??
    contact.relationshipType;
  const cadenceLine =
    daysSince == null
      ? tierLabel
      : daysSince < MONTH_SWITCH_DAYS
        ? `${tierLabel} · last contact ${daysSince} days ago`
        : `${tierLabel} · last contact ${Math.round(daysSince / 30)} months ago`;

  const handleOpen = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpen(contact.id);
  };

  const handleSnooze = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    snooze('social');
    onSnooze?.();
  };

  return (
    <View style={[styles.root, { borderLeftColor: c.social }]}>
      <Text variant="h1">{`${firstName} would love to hear from you.`}</Text>
      <Caption style={[styles.numeric, { color: c.textSecondary }]}>{cadenceLine}</Caption>
      <View style={styles.actions}>
        <Pressable
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel={`Say hello to ${firstName}`}
          style={[styles.pill, { backgroundColor: c.social }]}
        >
          <Body style={[styles.pillLabel, { color: c.inkOnColor }]}>Say hello</Body>
        </Pressable>
        <Pressable
          onPress={handleSnooze}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Not today"
        >
          <Caption style={{ color: c.textMuted }}>Not today</Caption>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  quiet: {
    gap: spacing.xs,
  },
  numeric: {
    ...TABULAR_NUMS,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: fonts.heading,
  },
});
