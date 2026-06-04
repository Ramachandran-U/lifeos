import { format, subDays, parseISO } from 'date-fns';
import { getTransactionsInRange } from '@/finance/db/transactionDb';
import { merchantRollups } from '@/finance/analytics';
import { buildLifeOsTools, type ToolContext } from './tools';
import type { AgentTool } from './runtime';

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const TOP_CATEGORIES = 6;
const TOP_MERCHANTS = 5;

/**
 * A read-only "where did my money go?" tool. Summarises recent spending (debits)
 * from the on-device finance store: total spent, a breakdown by category (with %
 * of total), and the top merchants, over a recent window. Amounts are converted
 * from paise to whole INR rupees so the model speaks natural numbers.
 *
 * Finance data is sensitive and stays on-device — this tool runs locally beside
 * the data, like every other agent tool. Nothing is sent to the proxy.
 */
function recentSpendingTool(ctx: ToolContext): AgentTool {
  return {
    declaration: {
      name: 'getRecentSpending',
      description:
        "The user's recent spending from their linked bank/UPI accounts: total spent, a " +
        'breakdown by category (with % of total), and top merchants, over a recent window. ' +
        "Amounts are in INR rupees. Use this to answer 'where did my money go?' and other " +
        'spending questions.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: `How many days back to summarise. Default ${DEFAULT_WINDOW_DAYS}.`,
          },
        },
      },
    },
    execute: async (args) => {
      const requested =
        typeof args.days === 'number' && args.days > 0 ? args.days : DEFAULT_WINDOW_DAYS;
      const days = Math.min(requested, MAX_WINDOW_DAYS);
      const end = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
      const start = format(subDays(parseISO(end), days - 1), 'yyyy-MM-dd');

      const debits = (await getTransactionsInRange(start, end)).filter(
        (t) => t.direction === 'debit',
      );
      if (debits.length === 0) {
        return {
          currency: 'INR',
          windowDays: days,
          totalSpentRupees: 0,
          byCategory: [],
          topMerchants: [],
          note: 'No transactions in this window. The user may not have synced their accounts (Gmail) yet.',
        };
      }

      const toRupees = (paise: number) => Math.round(paise / 100);
      const total = debits.reduce((sum, t) => sum + t.amount, 0);

      const byCategoryMap = new Map<string, number>();
      for (const t of debits) {
        byCategoryMap.set(t.category, (byCategoryMap.get(t.category) ?? 0) + t.amount);
      }
      const byCategory = Array.from(byCategoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_CATEGORIES)
        .map(([category, amount]) => ({
          category,
          amountRupees: toRupees(amount),
          pct: Math.round((amount / total) * 100),
        }));

      const topMerchants = merchantRollups(debits)
        .slice(0, TOP_MERCHANTS)
        .map((m) => ({ merchant: m.merchant, amountRupees: toRupees(m.total), count: m.count }));

      return {
        currency: 'INR',
        windowDays: days,
        totalSpentRupees: toRupees(total),
        byCategory,
        topMerchants,
      };
    },
  };
}

/**
 * The tool set the voice assistant can call. It's the read-only `buildLifeOsTools`
 * set (goals, today's routine, recent sleep, gamification momentum, overdue
 * contacts) plus a finance spending summary — so the voice agent can ground its
 * answers in the user's real data, exactly like the text "what should I do next?"
 * agent does. All tools are read-only and run on-device.
 */
export function buildVoiceTools(ctx: ToolContext): AgentTool[] {
  return [...buildLifeOsTools(ctx), recentSpendingTool(ctx)];
}
