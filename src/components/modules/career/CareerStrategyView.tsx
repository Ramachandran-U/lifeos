import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import type { CareerStrategy } from '@/ai/types';

interface Props {
  strategy: CareerStrategy;
  acceptedIds: Set<string>;
  onAcceptWeek: (weekIndex: number) => void;
  onAcceptDaily: (slot: 'deepWork' | 'build' | 'review', itemIndex: number) => void;
  onAcceptAll: () => void;
}

const priorityColor = (p: 'must' | 'should' | 'nice', c: ReturnType<typeof useColors>): string => {
  if (p === 'must') return c.error;
  if (p === 'should') return c.warning;
  return c.textSecondary;
};

export function CareerStrategyView({ strategy, acceptedIds, onAcceptWeek, onAcceptDaily, onAcceptAll }: Props) {
  const c = useColors();
  const s = makeStyles(c);

  const totalAcceptable =
    strategy.weeklyOutput.length +
    strategy.dailyPlan.deepWork.length +
    strategy.dailyPlan.build.length +
    strategy.dailyPlan.review.length;
  const allAccepted = acceptedIds.size >= totalAcceptable;

  return (
    <View style={s.wrap}>
      {/* Reality Check */}
      <Card moduleColor={c.error} style={s.card}>
        <Label color={c.error}>REALITY CHECK</Label>
        <Body style={{ color: c.textPrimary, lineHeight: 22 }}>{strategy.realityCheck}</Body>
      </Card>

      {/* MVS */}
      <Card moduleColor={c.career} style={s.card}>
        <Label color={c.career}>MINIMUM VIABLE SUCCESS</Label>
        <Heading style={[s.mvsMetric, { color: c.textPrimary }]}>{strategy.mvs.metric}</Heading>
        <Caption style={{ color: c.textSecondary }}>{strategy.mvs.outcome}</Caption>
      </Card>

      {/* Skill gaps */}
      <Card style={s.card}>
        <Label color={c.career}>SKILL GAPS</Label>
        {strategy.skillGaps.map((g, i) => (
          <View key={i} style={[s.skillRow, { borderColor: c.border }]}>
            <View style={s.skillHeader}>
              <Body style={[s.skillName, { color: c.textPrimary }]}>{g.skill}</Body>
              <View style={[s.priorityPill, { backgroundColor: priorityColor(g.priority, c) + '22' }]}>
                <Caption style={{ color: priorityColor(g.priority, c), fontFamily: fonts.heading }}>
                  {g.priority.toUpperCase()}
                </Caption>
              </View>
            </View>
            <View style={s.skillLevelRow}>
              <Caption style={{ color: c.textMuted, flex: 1 }}>
                <Caption style={{ color: c.textMuted }}>Now: </Caption>
                <Caption style={{ color: priorityColor(g.priority, c) }}>{g.currentLevel}</Caption>
              </Caption>
              <Ionicons name="arrow-forward" size={12} color={c.textMuted} />
              <Caption style={{ color: c.textPrimary, flex: 1, textAlign: 'right' }}>
                {g.requiredLevel}
              </Caption>
            </View>
          </View>
        ))}
      </Card>

      {/* Phases */}
      <Card style={s.card}>
        <Label color={c.career}>12-WEEK EXECUTION PLAN</Label>
        {strategy.phases.map((p, i) => {
          const phaseColors = [c.polymath, c.career, c.success];
          const pc = phaseColors[i] ?? c.career;
          return (
            <View key={p.name} style={[s.phaseBox, { borderLeftColor: pc, borderColor: c.border }]}>
              <View style={s.phaseHeader}>
                <Label color={pc}>PHASE {i + 1}: {p.name.toUpperCase()}</Label>
                <Caption style={{ color: c.textMuted }}>Weeks {p.weeks}</Caption>
              </View>
              <Caption style={{ color: c.textSecondary, marginBottom: spacing.xs }}>{p.focus}</Caption>
              {p.milestones.map((m, j) => (
                <View key={j} style={s.milestoneRow}>
                  <Ionicons name="ellipse" size={6} color={pc} />
                  <Caption style={{ color: c.textPrimary, flex: 1 }}>{m}</Caption>
                </View>
              ))}
            </View>
          );
        })}
      </Card>

      {/* Daily plan */}
      <Card style={s.card}>
        <View style={s.headerRow}>
          <Label color={c.career}>DAILY PLAN TEMPLATE</Label>
        </View>
        {(['deepWork', 'build', 'review'] as const).map((slot) => {
          const items = strategy.dailyPlan[slot];
          const slotLabel = slot === 'deepWork' ? 'Deep Work' : slot === 'build' ? 'Build' : 'Review';
          const slotColor = slot === 'deepWork' ? c.career : slot === 'build' ? c.success : c.textSecondary;
          return (
            <View key={slot} style={s.slotBox}>
              <Caption style={{ color: slotColor, fontFamily: fonts.heading, letterSpacing: 1 }}>
                {slotLabel.toUpperCase()}
              </Caption>
              {items.map((item, i) => {
                const acceptId = `daily:${slot}:${i}`;
                const accepted = acceptedIds.has(acceptId);
                return (
                  <View key={i} style={[s.dailyRow, { borderColor: c.border }]}>
                    <Body style={{ color: c.textPrimary, flex: 1 }}>{item}</Body>
                    <Pressable
                      onPress={() => onAcceptDaily(slot, i)}
                      disabled={accepted}
                      hitSlop={6}
                      style={[s.acceptPill, { backgroundColor: accepted ? c.surface : slotColor + '22' }]}
                    >
                      <Ionicons name={accepted ? 'checkmark' : 'add'} size={14} color={accepted ? c.success : slotColor} />
                      <Caption style={{ color: accepted ? c.success : slotColor, fontFamily: fonts.heading }}>
                        {accepted ? 'Added' : 'Accept'}
                      </Caption>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        })}
      </Card>

      {/* Weekly output */}
      <Card style={s.card}>
        <View style={s.headerRow}>
          <Label color={c.career}>WEEKLY OUTPUT</Label>
          <Pressable
            onPress={onAcceptAll}
            disabled={allAccepted}
            style={[s.acceptAllBtn, { backgroundColor: allAccepted ? c.surface : c.career }]}
          >
            <Ionicons
              name={allAccepted ? 'checkmark-done' : 'rocket-outline'}
              size={14}
              color={allAccepted ? c.textSecondary : '#fff'}
            />
            <Caption style={{ color: allAccepted ? c.textSecondary : '#fff', fontFamily: fonts.heading }}>
              {allAccepted ? 'All committed' : 'Commit all'}
            </Caption>
          </Pressable>
        </View>
        {strategy.weeklyOutput.map((w, i) => {
          const acceptId = `week:${i}`;
          const accepted = acceptedIds.has(acceptId);
          return (
            <View key={i} style={[s.weekRow, { borderColor: c.border }]}>
              <View style={[s.weekNum, { backgroundColor: c.careerDim ?? c.primaryDim }]}>
                <Caption style={{ color: c.career, fontFamily: fonts.heading }}>W{w.week}</Caption>
              </View>
              <View style={s.weekBody}>
                <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>{w.artifact}</Body>
                <Caption style={{ color: c.textSecondary }}>{w.description}</Caption>
              </View>
              <Pressable
                onPress={() => onAcceptWeek(i)}
                disabled={accepted}
                hitSlop={6}
                style={[s.acceptPill, { backgroundColor: accepted ? c.surface : c.careerDim ?? c.primaryDim }]}
              >
                <Ionicons name={accepted ? 'checkmark' : 'add'} size={14} color={accepted ? c.success : c.career} />
              </Pressable>
            </View>
          );
        })}
      </Card>

      {/* Failure points */}
      <Card moduleColor={c.warning} style={s.card}>
        <Label color={c.warning}>FAILURE POINTS</Label>
        {strategy.failurePoints.map((f, i) => (
          <View key={i} style={s.failureRow}>
            <Ionicons name="warning-outline" size={14} color={c.warning} />
            <Caption style={{ color: c.textPrimary, flex: 1 }}>{f}</Caption>
          </View>
        ))}
      </Card>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    wrap: { gap: spacing.md },
    card: { gap: spacing.sm },
    mvsMetric: { fontSize: fontSizes.lg },
    skillRow: { borderBottomWidth: 1, paddingVertical: spacing.sm, gap: spacing.xs },
    skillHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    skillName: { fontFamily: fonts.heading, flex: 1 },
    skillLevelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    phaseBox: {
      borderLeftWidth: 4, borderWidth: 1, borderRadius: 12,
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 4, marginTop: spacing.xs,
    },
    phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    slotBox: { gap: spacing.xs, marginTop: spacing.sm },
    dailyRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderWidth: 1, borderRadius: 10, padding: spacing.sm,
    },
    acceptPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
    },
    acceptAllBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: 10,
    },
    weekRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderWidth: 1, borderRadius: 12, padding: spacing.sm,
    },
    weekNum: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    weekBody: { flex: 1, gap: 2 },
    failureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 2 },
    priorityPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 6 },
  });
}
