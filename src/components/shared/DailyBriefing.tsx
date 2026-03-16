import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Body, Label } from '@/components/ui/Typography';

interface DailyBriefingProps {
  text: string;
}

export function DailyBriefing({ text }: DailyBriefingProps) {
  return (
    <LinearGradient
      colors={[colors.primary + '30', colors.career + '10']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Label color={colors.primary}>DAILY BRIEFING</Label>
      <Body style={styles.text}>{text}</Body>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
