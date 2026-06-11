import { View, StyleSheet } from 'react-native';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { BloodReportResult } from '@/ai/types';

interface BloodReportCardProps {
  result: BloodReportResult;
  date: string;
}

export function BloodReportCard({ result, date }: BloodReportCardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    normal: { bg: c.healthDim, text: c.healthText },
    high: { bg: c.surfaceAlt, text: c.error },
    low: { bg: c.surfaceAlt, text: c.warning },
  };
  return (
    // Neutral card — domain identity is the R2 eyebrow; status pills carry semantics.
    <Card>
      {/* Ink + Signal §3.0.7: the BLOOD REPORT caps eyebrow died in the W4
          Health sweep (2026-06-12) — sentence-case SectionTitle instead. */}
      <SectionTitle trailing={<Caption>{date}</Caption>}>Latest report</SectionTitle>

      <Body style={styles.summary}>{result.summary}</Body>

      <View style={styles.markers}>
        {result.markers.map((marker, i) => {
          const statusColor = STATUS_COLORS[marker.status] ?? STATUS_COLORS.normal;
          return (
            <View key={i} style={styles.markerRow}>
              <Body style={styles.markerName}>{marker.marker}</Body>
              <Body style={styles.markerValue}>{marker.value} {marker.unit}</Body>
              <View style={[styles.statusPill, { backgroundColor: statusColor.bg }]}>
                <Caption color={statusColor.text}>{marker.status}</Caption>
              </View>
            </View>
          );
        })}
      </View>

      {result.suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Label style={styles.suggestionsLabel}>Suggestions</Label>
          {result.suggestions.map((s, i) => (
            <Body key={i} style={styles.suggestion}>• {s}</Body>
          ))}
        </View>
      )}

      <Caption style={styles.disclaimer}>
        For informational purposes only. Consult your doctor.
      </Caption>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  summary: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  markers: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markerName: {
    flex: 1,
    fontSize: fontSizes.sm,
  },
  markerValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  suggestions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  suggestionsLabel: {
    marginBottom: spacing.xs,
  },
  suggestion: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  disclaimer: {
    marginTop: spacing.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
