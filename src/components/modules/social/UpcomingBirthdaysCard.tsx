import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { upcomingBirthdays, type Contact } from '@/db/queries/social';

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today 🎉';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

/**
 * Surfaces contacts with a birthday in the next ~30 days as a gentle prompt to
 * reach out — the payoff for importing birthdays. Renders nothing when none are
 * coming up. Pure data (works on web + native).
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
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="gift-outline" size={18} color={c.social} />
        <Label color={c.social}>UPCOMING BIRTHDAYS</Label>
      </View>
      {upcoming.map(({ contact, daysUntil }) => (
        <Pressable key={contact.id} style={styles.row} onPress={() => onPress(contact)}>
          <Body style={styles.cake}>🎂</Body>
          <Body style={styles.name}>{contact.nickname || contact.name}</Body>
          <Caption style={[styles.when, daysUntil <= 1 && { color: c.social, fontFamily: fonts.bodyMedium }]}>
            {whenLabel(daysUntil)}
          </Caption>
          <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
        </Pressable>
      ))}
    </Card>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: { gap: spacing.xs },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    cake: { fontSize: 16 },
    name: { flex: 1, color: c.textPrimary, fontFamily: fonts.bodyMedium },
    when: { color: c.textMuted },
  });
}
