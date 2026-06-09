import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption } from '@/components/ui/Typography';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  RELATIONSHIP_META,
  computeOverdue,
  type Contact,
} from '@/db/queries/social';

interface ContactRowProps {
  contact: Contact;
  onPress: () => void;
}

function recencyLabel(daysSinceContact: number | null): string {
  if (daysSinceContact === null) return 'No contact yet';
  if (daysSinceContact <= 0) return 'Today';
  if (daysSinceContact === 1) return 'Yesterday';
  if (daysSinceContact < 7) return `${daysSinceContact}d ago`;
  if (daysSinceContact < 30) return `${Math.round(daysSinceContact / 7)}w ago`;
  return `${Math.round(daysSinceContact / 30)}mo ago`;
}

export function ContactRow({ contact, onPress }: ContactRowProps) {
  const c = useColors();
  const overdue = computeOverdue(contact);
  const initial = (contact.nickname ?? contact.name).trim().charAt(0).toUpperCase() || '?';
  const cadenceLabel = `${RELATIONSHIP_META[contact.relationshipType as keyof typeof RELATIONSHIP_META]?.label ?? contact.relationshipType} · every ${contact.preferredCadenceDays}d`;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${contact.nickname?.trim() || contact.name}, ${cadenceLabel}`}
      style={[
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: overdue.isOverdue ? c.warning + '55' : c.border,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: c.social + '22', borderColor: c.social + '55' }]}>
        <Body style={[styles.avatarText, { color: c.social }]}>{initial}</Body>
      </View>
      <View style={styles.body}>
        <Body style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
          {contact.nickname?.trim() || contact.name}
        </Body>
        <Caption style={{ color: c.textMuted }} numberOfLines={1}>
          {cadenceLabel}
        </Caption>
      </View>
      <View style={styles.right}>
        <Caption style={{ color: overdue.isOverdue ? c.warning : c.textSecondary }}>
          {recencyLabel(overdue.daysSinceContact)}
        </Caption>
        {overdue.isOverdue ? (
          <View style={[styles.dot, { backgroundColor: c.warning }]} />
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
  },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.heading, fontSize: fontSizes.md },
  right: { alignItems: 'flex-end', gap: 4, marginRight: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
