import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { isEnabled } from '@/config/flags';
import { useUserStore } from '@/store/useUserStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import { detectStagnantDomain, domainToModule } from '@/cognition/domainStagnation';
import { buildDomainSuggestions } from '@/cognition/domainSuggestions';
import type { InsightSuggestion, CognitiveInsight } from '@/cognition/types';
import { getGoalsByUser } from '@/db/queries/goals';
import { getRoutineBlocksByDate, createRoutineBlocks } from '@/db/queries/routine';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { recordInsight, updateInsightStatus, isInsightCooldownOk } from '@/db/queries/cognitiveInsights';
import { DOMAIN_META } from '@/constants/gamification';
import type { DomainId } from '@/store/useUserStore';
import { track, EVENTS } from '@/utils/telemetry';

interface Props {
  userId: string;
  tomorrow: string;
}

export function DomainNudgeCard({ userId, tomorrow }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [insight, setInsight] = useState<{
    id: string;
    domain: DomainId;
    daysFlat: number;
    suggestions: InsightSuggestion[];
  } | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isEnabled('domainNudges')) return;
    const run = async () => {
      const { primaryDomains } = useUserStore.getState();
      const historyStore = useDomainHistoryStore.getState();
      const recentEvents = getEventsLastNDays(7);

      const candidate = detectStagnantDomain({
        primaryDomains,
        fullHistoryFor: (d) => historyStore.fullHistoryFor(d),
        isDomainFed: (d) => recentEvents.some((e) => e.module === domainToModule(d)),
        cooldownOk: (d) => isInsightCooldownOk(userId, 'domain_stagnation', d),
      });
      if (!candidate) return;

      const goals = getGoalsByUser(userId);
      const tomorrowBlocks = getRoutineBlocksByDate(tomorrow);
      const suggestions = await buildDomainSuggestions({
        domain: candidate.domain,
        goals: goals.map((g) => ({
          id: g.id, title: g.title, goalType: g.goalType, level: g.level, status: g.status,
        })),
        isGoalScheduled: (g) =>
          tomorrowBlocks.some((b) => b.linkedEntityId === g.id || b.title.toLowerCase() === g.title.toLowerCase()),
      });

      if (suggestions.length === 0) return;

      const insightId = recordInsight({
        userId,
        kind: 'domain_stagnation',
        domain: candidate.domain,
        evidence: { delta: candidate.delta, daysFlat: candidate.daysFlat, currentScore: candidate.currentScore },
        suggestions,
      });

      setInsight({ id: insightId, domain: candidate.domain, daysFlat: candidate.daysFlat, suggestions });
      track(EVENTS.domainNudgeShown ?? 'domain_nudge_shown', { domain: candidate.domain, suggestionCount: suggestions.length });
    };
    run();
  }, [userId, tomorrow]);

  const handleAccept = useCallback((idx: number) => {
    if (!insight) return;
    const s = insight.suggestions[idx];
    if (!s) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Use the platform-aware query (web localStorage / native SQLite) which ALSO
    // records a mutation — NOT the web-only shim, which silently no-ops on native
    // and bypasses the sync/audit log. id/createdAt/updatedAt are assigned inside.
    const startMin = 18 * 60; // 18:00 default focus slot
    const endMin = startMin + s.durationMin;
    const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    createRoutineBlocks([{
      date: tomorrow,
      startTime: '18:00',
      endTime,
      title: s.title,
      module: s.module,
      linkedEntityId: s.goalId ?? undefined,
    }]);
    setAccepted((prev) => new Set(prev).add(idx));
    updateInsightStatus(insight.id, 'accepted');
    track(EVENTS.domainNudgeAccepted ?? 'domain_nudge_accepted', { domain: insight.domain, source: s.source });
  }, [insight, tomorrow]);

  const handleDismiss = useCallback(() => {
    if (!insight) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateInsightStatus(insight.id, 'dismissed');
    setDismissed(true);
    track(EVENTS.domainNudgeDismissed ?? 'domain_nudge_dismissed', { domain: insight.domain });
  }, [insight]);

  if (!insight || dismissed || !isEnabled('domainNudgesVisible')) return null;

  const meta = DOMAIN_META.find((d) => d.key === insight.domain);
  const accent = meta ? c[meta.colorKey] : c.primary;

  return (
    // Neutral card — the domain ink lives in the eyebrow + inline domain name (R2).
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="pulse-outline" size={18} color={accent} />
        <Label color={accent}>GROWTH NUDGE</Label>
      </View>
      <Body style={styles.body}>
        Your <Body style={{ fontFamily: fonts.heading, color: accent }}>{meta?.label ?? insight.domain}</Body> hasn't moved in {insight.daysFlat} days. Want to fold in something small?
      </Body>
      <View style={styles.suggestions}>
        {insight.suggestions.map((s, i) => {
          const done = accepted.has(i);
          return (
            <Pressable
              key={i}
              onPress={() => !done && handleAccept(i)}
              disabled={done}
              style={[styles.chip, { borderColor: done ? c.success : c.border, backgroundColor: done ? c.surfaceAlt : 'transparent' }]}
            >
              <Ionicons name={done ? 'checkmark-circle' : 'add-circle-outline'} size={16} color={done ? c.success : accent} />
              <Caption style={{ color: done ? c.success : c.textPrimary, fontFamily: fonts.heading, flex: 1 }}>{s.title}</Caption>
              <Caption style={{ color: c.textMuted }}>{s.durationMin}m</Caption>
            </Pressable>
          );
        })}
      </View>
      {accepted.size === 0 && (
        <Button title="Not now" variant="secondary" onPress={handleDismiss} style={styles.dismiss} />
      )}
      {accepted.size > 0 && (
        <Caption style={{ color: c.success, fontFamily: fonts.heading, marginTop: spacing.sm }}>
          Added to tomorrow's plan.
        </Caption>
      )}
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { color: c.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  suggestions: { gap: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1,
  },
  dismiss: { marginTop: spacing.xs },
});
