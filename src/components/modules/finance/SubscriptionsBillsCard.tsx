import { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET } from '@/theme/motion';
import { Card } from '@/components/ui/Card';
import { Body, Caption } from '@/components/ui/Typography';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { formatInr } from '@/finance/display';
import { useRecurringStore } from '@/finance/store/useRecurringStore';
import { summarizeRecurring, formatDueLabel } from '@/finance/recurringSummary';
import type { RecurringItemRecord } from '@/finance/db/transactionDb';

/**
 * Subscription audit + bill-due reminders, fed by useRecurringStore (Gmail).
 * Web-only (Gmail OAuth is web-only) — renders null on native. Reuses the
 * existing Gmail connection; the audit math lives in recurringSummary.ts so
 * this stays a thin view.
 */
export function SubscriptionsBillsCard({ clientId }: { clientId?: string }) {
  const c = useColors();
  const styles = makeStyles(c);
  const { items, syncing, syncError, load, refreshConnection, sync, dismiss } = useRecurringStore();

  useEffect(() => {
    refreshConnection();
    void load();
  }, [load, refreshConnection]);

  const today = new Date().toISOString().slice(0, 10);
  const { subscriptions, bills, monthlySubscriptionTotalPaise } = useMemo(
    () => summarizeRecurring(items),
    [items],
  );

  if (Platform.OS !== 'web') return null;

  const onScan = () => {
    if (clientId) void sync(clientId);
  };
  const hasAny = subscriptions.length > 0 || bills.length > 0;

  const renderRow = (it: RecurringItemRecord) => {
    const dueLabel = formatDueLabel(it.dueDate, today);
    const pastDue = dueLabel === 'Past due';
    const meta = [dueLabel, it.cadence].filter(Boolean).join(' · ');
    return (
      <View key={it.id} style={styles.row}>
        <View style={styles.rowText}>
          <Body style={styles.merchant}>{it.merchant}</Body>
          {meta !== '' && (
            <Caption style={{ color: pastDue ? c.error : c.textMuted }}>{meta}</Caption>
          )}
        </View>
        {it.amount > 0 && <Body style={styles.amount}>{formatInr(it.amount)}</Body>}
        <Pressable onPress={() => void dismiss(it.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={16} color={c.textMuted} />
        </Pressable>
      </View>
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(160).duration(MOTION_BUDGET.reveal)}>
      <Card style={styles.card}>
        {/* Ink + Signal §3.0.7: the SUBSCRIPTIONS & BILLS caps eyebrow died in
            the W4 Finance sweep (2026-06-12) — sentence-case SectionTitle, the
            scan action in its trailing slot. */}
        <SectionTitle
          trailing={
            <Pressable
              onPress={onScan}
              disabled={syncing}
              style={[styles.scanBtn, { borderColor: c.finance }]}
            >
              {syncing ? (
                <LoadingDots />
              ) : (
                <>
                  <Ionicons name="search" size={13} color={c.finance} />
                  <Caption style={{ color: c.finance, fontWeight: '700' }}>Scan inbox</Caption>
                </>
              )}
            </Pressable>
          }
        >
          Subscriptions & bills
        </SectionTitle>

        {monthlySubscriptionTotalPaise > 0 && (
          <View style={styles.totalRow}>
            <Body style={styles.total}>{formatInr(monthlySubscriptionTotalPaise)}/mo</Body>
            <Caption style={{ color: c.textMuted }}>
              across {subscriptions.length} subscription{subscriptions.length === 1 ? '' : 's'}
            </Caption>
          </View>
        )}

        {subscriptions.length > 0 && (
          <>
            <Caption style={styles.sectionLabel}>Subscriptions</Caption>
            {subscriptions.map(renderRow)}
          </>
        )}

        {bills.length > 0 && (
          <>
            <Caption style={styles.sectionLabel}>Upcoming bills</Caption>
            {bills.map(renderRow)}
          </>
        )}

        {!hasAny && !syncing && (
          <Caption style={{ color: c.textMuted }}>
            No subscriptions or bills found yet. Tap Scan inbox to surface recurring charges and due
            dates from your email.
          </Caption>
        )}

        {syncError !== null && <Caption style={{ color: c.error }}>{syncError}</Caption>}
      </Card>
    </Animated.View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: { gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 10,
      borderWidth: 1.5,
      minWidth: 104,
      justifyContent: 'center',
    },
    totalRow: { gap: 2 },
    total: { fontFamily: fonts.heading, fontSize: fontSizes.xxl, color: c.textPrimary },
    sectionLabel: { color: c.textMuted, marginTop: spacing.xs, letterSpacing: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowText: { flex: 1 },
    merchant: { fontSize: fontSizes.sm, color: c.textPrimary, fontFamily: fonts.bodyMedium },
    amount: { color: c.textPrimary, fontFamily: fonts.bodyMedium },
  });
}
