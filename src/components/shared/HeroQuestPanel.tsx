/**
 * HeroQuestPanel — the Today's-Quest slide of the Today hero carousel.
 *
 * Folds the old stacked quest list into one panel: a headline-led neutral
 * surface (Manifesto P5 — no caps eyebrow) holding up to two live quests as
 * the existing compact QuestCards (so claim / progress / press behaviour and
 * the detail sheet stay identical), with a "+N more" footer when the day has
 * extra quests. Domain hues + xp gold carry the signal; no violet.
 *
 * Presentation only — quests, claim and the detail sheet are owned upstream.
 */
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import type { Quest } from '@/constants/gamification';
import { Text as AuroraText } from '@/components/ui/Text';
import { QuestCard } from '@/components/gamification/QuestCard';

interface HeroQuestPanelProps {
  /** Live quests for today (already filtered + capped upstream). */
  quests: Quest[];
  /** Open the quest detail sheet. */
  onQuestPress: (quest: Quest) => void;
  /** quests_v2 only — claim a completed-but-unbanked quest. */
  onClaim?: (quest: Quest) => void;
}

const MAX_VISIBLE = 2;

export function HeroQuestPanel({ quests, onQuestPress, onClaim }: HeroQuestPanelProps) {
  const c = useColors();
  if (quests.length === 0) return null;

  const visible = quests.slice(0, MAX_VISIBLE);
  const extra = quests.length - visible.length;
  const done = quests.filter((q) => q.progress >= q.total).length;

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceAlt }]}>
      <View style={styles.headerRow}>
        <AuroraText variant="h3">Today&apos;s quest</AuroraText>
        <AuroraText variant="caption" secondary numeric>
          {`${done}/${quests.length} done`}
        </AuroraText>
      </View>

      <View style={styles.list}>
        {visible.map((q) => (
          <QuestCard
            key={q.id}
            quest={q}
            compact
            onPress={() => onQuestPress(q)}
            onClaim={onClaim ? () => onClaim(q) : undefined}
          />
        ))}
      </View>

      {extra > 0 ? (
        <AuroraText variant="caption" muted>
          {`+${extra} more ${extra === 1 ? 'quest' : 'quests'} today`}
        </AuroraText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  list: {
    gap: spacing.sm,
  },
});
