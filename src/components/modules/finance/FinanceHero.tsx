import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Text } from '@/components/ui/Text';
import { Body, Caption } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatInr } from '@/finance/display';

interface FinanceHeroProps {
  /** useTransactionStore.gmailConnected (web); ignored off-web. */
  gmailConnected: boolean;
  /** Total transaction count — gates the spend numerals (§3.0.5 / AC8). */
  txCount: number;
  /** Consumption spend this month-to-date, paise. */
  thisMonthSpendPaise: number;
  /** Consumption spend over the same elapsed day-range last month, paise. */
  lastMonthSpendPaise: number;
  /** Credits this month, paise — gates the In/Out/Net cashflow strip. */
  thisMonthIncomePaise: number;
  /** Starts the Gmail OAuth flow (disconnected web state's CTA). */
  onConnect: () => void;
}

/**
 * THE Finance hero (Ink + Signal §3.5), rendered inside the Overview tab
 * directly under the inner tab bar. Four states:
 *  - native: Finance lives on the web — the localhost developer string died
 *    with the legacy card (dilution audit 19)
 *  - web, disconnected: the keeper connect block migrated onto the shared
 *    EmptyState, trust copy via the trustNote prop (AC13)
 *  - web, connected, zero transactions: the first-value action line — no ₹0
 *    display ever renders (§3.0.5 zero-suppression, AC8)
 *  - web, connected, transactions: the spend headline — display numerals in
 *    c.financeText in BOTH themes (R4), delta caption, In/Out/Net strip in
 *    mono numerals
 *
 * Chrome (connected): type on the screen background behind a 4px raw
 * `c.finance` left border (R4/R9) — no Card. No idle motion lives here — the
 * screen owns the one hero-budget entry.
 */
export function FinanceHero({
  gmailConnected,
  txCount,
  thisMonthSpendPaise,
  lastMonthSpendPaise,
  thisMonthIncomePaise,
  onConnect,
}: FinanceHeroProps) {
  const c = useColors();

  if (Platform.OS !== 'web') {
    return (
      <EmptyState
        icon="information-circle-outline"
        title="Finance lives on the web for now"
        caption="Gmail-powered transaction sync runs in the web app. Open LifeOS in your browser to connect."
        accent={c.finance}
      />
    );
  }

  if (!gmailConnected) {
    return (
      <EmptyState
        icon="mail-outline"
        title="Connect your inbox"
        caption="LifeOS reads HDFC, ICICI, and Axis bank alert emails to categorise spending and surface behavioural insights."
        accent={c.finance}
        trustNote="Only transaction emails are scanned — nothing is uploaded."
        cta={{ label: 'Connect Gmail', onPress: onConnect }}
      />
    );
  }

  // Connected, nothing ingested yet: the slot is the action that produces the
  // first value (§3.0.5) — no rail (no finance ink/CTA here, R9), no numerals.
  if (txCount === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Caption style={{ color: c.textMuted, textAlign: 'center' }}>
          No transactions yet. Tap Sync now after connecting an inbox with bank alert emails.
        </Caption>
      </View>
    );
  }

  const delta =
    lastMonthSpendPaise > 0
      ? ((thisMonthSpendPaise - lastMonthSpendPaise) / lastMonthSpendPaise) * 100
      : 0;
  const netCashflow = thisMonthIncomePaise - thisMonthSpendPaise;

  return (
    <View style={[styles.root, { borderLeftColor: c.finance }]}>
      <Text variant="display" numeric color={c.financeText}>
        {formatInr(thisMonthSpendPaise)}
      </Text>
      <Text variant="h3" color={c.textPrimary}>
        spent so far this month
      </Text>

      {lastMonthSpendPaise > 0 && (
        <View style={styles.deltaRow}>
          <Ionicons
            name={delta >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={delta >= 0 ? c.error : c.success}
          />
          <Caption style={{ color: delta >= 0 ? c.error : c.success }}>
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}% vs same period last month ({formatInr(lastMonthSpendPaise)})
          </Caption>
        </View>
      )}

      {/* Cashflow strip: income in vs spend out → net (mono numerals, §3.5). */}
      {thisMonthIncomePaise > 0 && (
        <View style={[styles.cashflowRow, { borderTopColor: c.border }]}>
          <View style={styles.cashflowCell}>
            <Caption style={{ color: c.textMuted }}>In</Caption>
            <Body style={[styles.cashflowValue, { color: c.success }]}>
              {formatInr(thisMonthIncomePaise)}
            </Body>
          </View>
          <View style={styles.cashflowCell}>
            <Caption style={{ color: c.textMuted }}>Out</Caption>
            <Body style={[styles.cashflowValue, { color: c.error }]}>
              {formatInr(thisMonthSpendPaise)}
            </Body>
          </View>
          <View style={styles.cashflowCell}>
            <Caption style={{ color: c.textMuted }}>Net</Caption>
            <Body
              style={[styles.cashflowValue, { color: netCashflow >= 0 ? c.success : c.error }]}
            >
              {netCashflow >= 0 ? '+' : '−'}
              {formatInr(Math.abs(netCashflow))}
            </Body>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  emptyWrap: {
    paddingVertical: spacing.lg,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cashflowRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cashflowCell: { flex: 1, gap: 2 },
  cashflowValue: {
    fontFamily: fonts.mono,
    ...TABULAR_NUMS,
  },
});
