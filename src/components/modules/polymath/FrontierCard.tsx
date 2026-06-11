import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import type { Frontier } from '@/explore/frontier';

interface Props {
  frontier: Frontier;
  onExplore: (frontier: Frontier) => void;
}

/**
 * "The frontier" — the discovery surface of the redesigned Explore tab.
 * Instead of a grid of adjacent topics to add, it shows the single most
 * fertile gap BETWEEN two interests the user already has: the two endpoints
 * with an untraveled edge between them, the insight, and one bridge action.
 */
export function FrontierCard({ frontier, onExplore }: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  const handleExplore = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExplore(frontier);
  };

  return (
    // Neutral card — the polymath ink lives in the eyebrow + mark (R2/R3).
    <Card style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="git-compare-outline" size={16} color={c.polymathText} />
        <Label color={c.polymathText}>THE FRONTIER</Label>
      </View>

      {/* The two endpoints with the untraveled edge between them. */}
      <View style={styles.edgeRow}>
        <View style={[styles.endpoint, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Body style={[styles.endpointText, { color: c.textPrimary }]} numberOfLines={2}>
            {frontier.interestA}
          </Body>
        </View>
        <View style={styles.gap}>
          <View style={[styles.gapLine, { backgroundColor: c.border }]} />
          <Caption style={[styles.gapMark, { color: c.polymathText, backgroundColor: c.background }]}>?</Caption>
        </View>
        <View style={[styles.endpoint, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Body style={[styles.endpointText, { color: c.textPrimary }]} numberOfLines={2}>
            {frontier.interestB}
          </Body>
        </View>
      </View>

      <Heading style={styles.headline}>{frontier.headline}</Heading>
      <Body style={[styles.insight, { color: c.textSecondary }]}>{frontier.insight}</Body>

      <View style={[styles.bridgeBox, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Ionicons name="construct-outline" size={15} color={c.polymath} />
        <Body style={{ color: c.textPrimary, flex: 1 }}>{frontier.bridgeAction}</Body>
      </View>

      <Pressable onPress={handleExplore} style={[styles.exploreBtn, { backgroundColor: c.polymath }]}>
        <Caption style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Explore this gap</Caption>
        <Ionicons name="arrow-forward" size={15} color={c.inkOnColor} />
      </Pressable>
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  edgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  endpoint: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, alignItems: 'center',
  },
  endpointText: { fontFamily: fonts.heading, fontSize: fontSizes.sm, textAlign: 'center' },
  gap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  gapLine: { position: 'absolute', height: 1, left: 0, right: 0 },
  gapMark: { fontFamily: fonts.heading, fontSize: fontSizes.md, paddingHorizontal: 6 },
  headline: { fontSize: fontSizes.lg, color: c.textPrimary, marginTop: spacing.xs },
  insight: { lineHeight: 20 },
  bridgeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    borderWidth: 1, borderRadius: 12, padding: spacing.sm, marginTop: spacing.xs,
  },
  exploreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, marginTop: spacing.xs,
  },
});
