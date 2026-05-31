import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { recoveryBandLabel, type RecoveryResult } from '@/utils/recovery';

interface RecoveryCardProps {
  result: RecoveryResult;
}

/**
 * Oura/Whoop-style daily readiness card. Shows the 0–100 score, a band label,
 * the contributing drivers, and a one-liner connecting it to the Routine Builder
 * (a low score softens the rest of today's plan when the user re-plans).
 */
export function RecoveryCard({ result }: RecoveryCardProps) {
  const c = useColors();
  const styles = makeStyles(c);

  if (!result.hasData) {
    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="pulse-outline" size={18} color={c.health} />
          <SectionLabel color={c.health}>RECOVERY</SectionLabel>
        </View>
        <Caption style={{ color: c.textSecondary }}>
          Sync Google Fit or log last night&apos;s sleep to see your readiness score.
        </Caption>
      </Card>
    );
  }

  const bandColor = result.band === 'high' ? c.health : result.band === 'moderate' ? c.warning : c.error;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="pulse-outline" size={18} color={bandColor} />
        <SectionLabel color={bandColor}>RECOVERY</SectionLabel>
      </View>

      <View style={styles.scoreRow}>
        <Body style={[styles.score, { color: bandColor }]}>{result.score}</Body>
        <View style={styles.scoreMeta}>
          <Body style={styles.band}>{recoveryBandLabel(result.band)}</Body>
          <Caption style={{ color: c.textSecondary }}>readiness / 100</Caption>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${result.score}%`, backgroundColor: bandColor }]} />
      </View>

      {result.drivers.length > 0 && (
        <Caption style={{ color: c.textSecondary }}>{result.drivers.join(' · ')}</Caption>
      )}

      <Caption style={styles.plannerNote}>
        {result.band === 'low'
          ? 'Low today — Re-plan will ease your remaining blocks.'
          : 'Re-plan adapts your day to this score.'}
      </Caption>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  score: { fontFamily: fonts.display, fontSize: fontSizes.hero },
  scoreMeta: { gap: 2 },
  band: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.lg },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  plannerNote: { color: colors.textMuted, fontStyle: 'italic' },
});
