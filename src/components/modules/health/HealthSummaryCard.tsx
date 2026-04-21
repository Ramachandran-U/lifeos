import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import type { VitalsSummary } from '@/utils/health';

interface Props {
  summary: VitalsSummary;
}

export function HealthSummaryCard({ summary }: Props) {
  return (
    <Card style={styles.card}>
      <Label color={colors.health}>HEALTH SUMMARY</Label>
      <Body style={styles.headline}>{summary.headline}</Body>
      <Caption>{summary.detail}</Caption>

      {summary.suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {summary.suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.health} />
              <Caption style={styles.suggestionText}>{s}</Caption>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  headline: { fontWeight: '600' },
  suggestions: { gap: spacing.xs, marginTop: spacing.xs },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  suggestionText: { flex: 1, color: colors.textSecondary },
});
