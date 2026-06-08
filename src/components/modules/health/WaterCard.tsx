import { useState } from 'react';
import { View, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { createHealthLog } from '@/db/queries/health';

const WATER_BLUE = '#4DA3FF';
const INCREMENTS = [150, 250, 500];
// Sanity ceiling for a single custom log — guards against a stray extra digit
// (e.g. 2500 typed as 25000) skewing the day's total.
const MAX_CUSTOM_ML = 4000;

interface WaterCardProps {
  totalMl: number;
  goalMl: number;
  onLogged: () => void;
}

/** Daily hydration tracker. Each tap logs a `waterMl` increment to health_logs;
 *  the parent sums the day's rows for the total. */
export function WaterCard({ totalMl, goalMl, onLogged }: WaterCardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const pct = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;

  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const add = (ml: number) => {
    createHealthLog({ date: format(new Date(), 'yyyy-MM-dd'), waterMl: ml });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  const closeCustom = () => {
    setCustomOpen(false);
    setCustomValue('');
  };

  // Parse the typed value, accept only a sane positive amount, then log it.
  const submitCustom = () => {
    const ml = Math.round(Number(customValue));
    if (!Number.isFinite(ml) || ml <= 0) return;
    add(Math.min(ml, MAX_CUSTOM_ML));
    closeCustom();
  };

  const parsedCustom = Math.round(Number(customValue));
  const customValid = Number.isFinite(parsedCustom) && parsedCustom > 0;

  const undo = () => {
    if (totalMl <= 0) return;
    // Log a negative increment to correct an over-count (sum-based total).
    createHealthLog({ date: format(new Date(), 'yyyy-MM-dd'), waterMl: -Math.min(250, totalMl) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="water-outline" size={18} color={WATER_BLUE} />
        <SectionLabel color={WATER_BLUE}>HYDRATION</SectionLabel>
      </View>

      <View style={styles.row}>
        <Body style={styles.total}>
          {(totalMl / 1000).toFixed(totalMl % 1000 === 0 ? 0 : 1)}
          <Caption style={{ color: c.textSecondary }}> / {(goalMl / 1000).toFixed(1)} L</Caption>
        </Body>
        {totalMl > 0 && (
          <Pressable onPress={undo} hitSlop={6} accessibilityRole="button" accessibilityLabel="Undo last water">
            <Caption style={{ color: c.textMuted }}>Undo</Caption>
          </Pressable>
        )}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: WATER_BLUE }]} />
      </View>

      <View style={styles.actions}>
        {INCREMENTS.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => add(ml)}
            style={[styles.addBtn, { borderColor: WATER_BLUE }]}
            accessibilityRole="button"
            accessibilityLabel={`Add ${ml} millilitres of water`}
          >
            <Ionicons name="add" size={14} color={WATER_BLUE} />
            <Caption style={{ color: WATER_BLUE, fontFamily: fonts.bodyMedium }}>{ml} ml</Caption>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setCustomOpen(true)}
          style={[styles.addBtn, { borderColor: WATER_BLUE }]}
          accessibilityRole="button"
          accessibilityLabel="Add a custom amount of water"
        >
          <Ionicons name="create-outline" size={14} color={WATER_BLUE} />
          <Caption style={{ color: WATER_BLUE, fontFamily: fonts.bodyMedium }}>Custom</Caption>
        </Pressable>
      </View>

      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={closeCustom}>
        <Pressable style={styles.backdrop} onPress={closeCustom}>
          {/* Stop taps inside the sheet from dismissing it. */}
          <Pressable style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}}>
            <Heading style={{ color: c.textPrimary, fontSize: fontSizes.lg }}>Add water</Heading>
            <Caption style={{ color: c.textSecondary }}>Enter an amount in millilitres.</Caption>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { backgroundColor: c.card, color: c.textPrimary, borderColor: c.border }]}
                placeholder="e.g. 350"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                value={customValue}
                onChangeText={setCustomValue}
                onSubmitEditing={submitCustom}
                returnKeyType="done"
                autoFocus
                accessibilityLabel="Custom water amount in millilitres"
              />
              <Caption style={{ color: c.textSecondary }}>ml</Caption>
            </View>
            <View style={styles.sheetActions}>
              <Pressable onPress={closeCustom} style={styles.sheetBtn} accessibilityRole="button">
                <Body style={{ color: c.textSecondary }}>Cancel</Body>
              </Pressable>
              <Pressable
                onPress={submitCustom}
                disabled={!customValid}
                style={[styles.sheetBtn, styles.sheetBtnPrimary, !customValid && { opacity: 0.4 }]}
                accessibilityRole="button"
              >
                <Body style={{ color: '#fff', fontFamily: fonts.bodyMedium }}>Add</Body>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontFamily: fonts.display, fontSize: fontSizes.xl },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
  },
  sheetBtnPrimary: {
    backgroundColor: WATER_BLUE,
  },
});
