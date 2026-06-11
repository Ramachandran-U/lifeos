import { StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Body, Caption } from '@/components/ui/Typography';

interface SocialScoreCardProps {
  score: number | null;
  totalContacts: number;
  overdueCount: number;
}

export function SocialScoreCard({ score, totalContacts, overdueCount }: SocialScoreCardProps) {
  const c = useColors();
  const display = score === null ? '—' : `${score}`;
  const subtitle =
    score === null
      ? 'Add a few people to see your social health.'
      : overdueCount === 0
      ? "You're in cadence with everyone right now."
      : `${overdueCount} contact${overdueCount === 1 ? '' : 's'} overdue · ${totalContacts - overdueCount} in cadence`;

  return (
    <Card moduleColor={c.social}>
      <View style={styles.headerRow}>
        <View>
          <Caption style={{ color: c.textMuted }}>Social health</Caption>
          <View style={styles.scoreRow}>
            <Body style={[styles.score, { color: c.textPrimary }]}>{display}</Body>
            {score !== null ? (
              <Body style={[styles.scoreSuffix, { color: c.textMuted }]}> /100</Body>
            ) : null}
          </View>
        </View>
      </View>
      {score !== null ? (
        <View style={styles.progress}>
          <ProgressBar value={score} color={c.social} />
        </View>
      ) : null}
      <Caption style={{ color: c.textSecondary, marginTop: spacing.xs }}>{subtitle}</Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { fontFamily: fonts.display, fontSize: fontSizes.display },
  scoreSuffix: { fontFamily: fonts.body, fontSize: fontSizes.md },
  progress: { marginTop: spacing.sm },
});
