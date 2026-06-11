import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { upcomingBirthdays, type Contact } from '@/db/queries/social';

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

/**
 * Surfaces contacts with a birthday in the next ~30 days as a gentle prompt to
 * reach out — the payoff for importing birthdays. Renders nothing when none are
 * coming up. Pure data (works on web + native).
 *
 * Re-skinned in the W4 Social PR (Ink + Signal §3.0.5 / §3.0.7 / §3.4 item 2,
 * unconditional — shared with the legacy tree): the Card chrome, the caps
 * UPCOMING BIRTHDAYS eyebrow, and both emoji glyphs (cake + party) died. Each
 * birthday is a plain hairline row with `gift-outline` in social ink; the
 * recomposed screen renders the `Coming up` SectionTitle above this component.
 */
export function UpcomingBirthdaysCard({
  contacts,
  onPress,
}: {
  contacts: Contact[];
  onPress: (c: Contact) => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const upcoming = useMemo(() => upcomingBirthdays(contacts).slice(0, 5), [contacts]);

  if (upcoming.length === 0) return null;

  return (
    <View>
      {upcoming.map(({ contact, daysUntil }) => (
        <Pressable
          key={contact.id}
          style={[styles.row, { borderTopColor: c.border }]}
          onPress={() => onPress(contact)}
          accessibilityRole="button"
          accessibilityLabel={`${contact.nickname || contact.name}, birthday ${whenLabel(daysUntil).toLowerCase()}`}
        >
          <Ionicons name="gift-outline" size={16} color={c.social} />
          <Body style={styles.name}>{contact.nickname || contact.name}</Body>
          <Caption style={[styles.when, daysUntil <= 1 && { color: c.social, fontFamily: fonts.bodyMedium }]}>
            {whenLabel(daysUntil)}
          </Caption>
          <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 56,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    name: { flex: 1, color: c.textPrimary, fontFamily: fonts.bodyMedium },
    when: { color: c.textMuted },
  });
}
