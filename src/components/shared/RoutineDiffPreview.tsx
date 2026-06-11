import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import type { ReplanRemainingDay } from '@/ai/types';

export interface ExistingBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
}

interface Props {
  /** Existing blocks the user has remaining today (for context — names of dropped/edited ids). */
  existing: ExistingBlock[];
  plan: ReplanRemainingDay;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoutineDiffPreview({ existing, plan, loading, onConfirm, onCancel }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const byId = new Map(existing.map((b) => [b.id, b]));

  const drops = plan.drop.map((id) => byId.get(id)).filter((b): b is ExistingBlock => !!b);
  const edits = plan.edits.map((e) => ({ ...e, original: byId.get(e.id) }));
  const totalChanges = plan.drop.length + plan.edits.length + plan.add.length;

  return (
    <View style={styles.container}>
      <Label color={c.primaryDim} style={styles.eyebrow}>PROPOSED CHANGES TO TODAY</Label>
      <Heading style={styles.title}>
        {totalChanges === 0 ? 'No changes needed' : `${totalChanges} change${totalChanges === 1 ? '' : 's'}`}
      </Heading>

      {plan.rationale ? (
        <Body style={styles.rationale}>{plan.rationale}</Body>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={{ gap: spacing.xs }}>
        {drops.length > 0 && (
          <View style={styles.section}>
            <Label color={c.error}>REMOVE</Label>
            {drops.map((b) => (
              <View key={b.id} style={[styles.row, { borderLeftColor: c.error }]}>
                <Ionicons name="close-circle-outline" size={14} color={c.error} />
                <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, width: 60 }}>
                  {b.startTime}-{b.endTime}
                </Caption>
                <Body style={{ flex: 1, color: c.textSecondary, textDecorationLine: 'line-through' }} numberOfLines={1}>
                  {b.title}
                </Body>
              </View>
            ))}
          </View>
        )}

        {edits.length > 0 && (
          <View style={styles.section}>
            <Label color={c.warning}>ADJUST</Label>
            {edits.map((e, i) => {
              const newStart = e.startTime ?? e.original?.startTime ?? '';
              const newEnd = e.endTime ?? e.original?.endTime ?? '';
              const newTitle = e.title ?? e.original?.title ?? '';
              return (
                <View key={e.id ?? i} style={[styles.row, { borderLeftColor: c.warning }]}>
                  <Ionicons name="swap-horizontal" size={14} color={c.warning} />
                  <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, width: 60 }}>
                    {newStart}-{newEnd}
                  </Caption>
                  <Body style={{ flex: 1, color: c.textPrimary }} numberOfLines={1}>
                    {newTitle}
                  </Body>
                </View>
              );
            })}
          </View>
        )}

        {plan.add.length > 0 && (
          <View style={styles.section}>
            <Label color={c.success}>ADD</Label>
            {plan.add.map((b, i) => (
              <View key={i} style={[styles.row, { borderLeftColor: c.success }]}>
                <Ionicons name="add-circle-outline" size={14} color={c.success} />
                <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, width: 60 }}>
                  {b.startTime}-{b.endTime}
                </Caption>
                <Body style={{ flex: 1, color: c.textPrimary }} numberOfLines={1}>
                  {b.title}
                </Body>
              </View>
            ))}
          </View>
        )}

        {totalChanges === 0 && !loading && (
          <Body style={{ color: c.textMuted, textAlign: 'center', paddingVertical: spacing.lg }}>
            The remaining day already matches your new priorities — nothing to change.
          </Body>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} disabled={loading} />
        <Button
          title={loading ? 'Planning…' : (totalChanges === 0 ? 'Close' : 'Apply')}
          onPress={onConfirm}
          style={{ flex: 1 }}
          disabled={loading}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { gap: spacing.sm },
  eyebrow: { letterSpacing: 1 },
  title: { color: c.textPrimary },
  rationale: { color: c.textSecondary, fontStyle: 'italic' },
  scroll: { maxHeight: 280, marginVertical: spacing.sm },
  section: { gap: spacing.xs, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 8, paddingHorizontal: 10,
    borderLeftWidth: 3, borderRadius: 8,
    backgroundColor: c.surface,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
