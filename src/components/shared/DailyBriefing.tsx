import { StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts } from '@/theme/typography';
import { Body, Label, Caption } from '@/components/ui/Typography';

interface DailyBriefingProps {
  text: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function DailyBriefing({ text, ctaLabel, onCtaPress }: DailyBriefingProps) {
  const c = useColors();
  return (
    <LinearGradient
      colors={[c.primary + '30', c.career + '10']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: c.border }]}
    >
      <Label color={c.primary}>DAILY BRIEFING</Label>
      <Body style={[styles.text, { color: c.textSecondary }]}>{text}</Body>
      {ctaLabel && onCtaPress && (
        <Pressable onPress={onCtaPress} style={[styles.cta, { backgroundColor: c.primary }]} hitSlop={6}>
          <Caption style={[styles.ctaText, { color: '#fff' }]}>{ctaLabel}</Caption>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    lineHeight: 22,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    marginTop: 4,
  },
  ctaText: {
    fontFamily: fonts.heading,
  },
});
