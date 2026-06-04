import { format, subDays, parseISO } from 'date-fns';
import { getTransactionsInRange } from '@/finance/db/transactionDb';
import { merchantRollups } from '@/finance/analytics';
import { getUser } from '@/db/queries/users';
import { getRecentWeightLogs, getFoodEntriesByDate } from '@/db/queries/health';
import { calorieTargets } from '@/utils/health';
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
 * A read-only "what should I eat?" tool. Returns the user's nutrition so far
 * today against their personalised calorie/macro target — consumed, target, and
 * what's remaining — plus their health goal, so the voice agent can ground meal
 * and lunch suggestions in real data instead of guessing. Reuses the same
 * Mifflin–St Jeor engine (`calorieTargets`) the Health screen shows; when vitals
 * are missing it returns the generic estimate flagged `personalised: false`.
 *
 * Health data is sensitive and stays on-device; this runs locally.
 */
function todayNutritionTool(ctx: ToolContext): AgentTool {
  return {
    declaration: {
      name: 'getTodayNutrition',
      description:
        "The user's nutrition so far today vs their personalised calorie/macro target: " +
        'calories and protein/carbs/fat consumed, the target, what is remaining, and their ' +
        "health goal. Use this to answer 'what should I eat?', lunch/meal suggestions, and " +
        'whether they are on track today. Targets are guidance, not medical advice.',
      parameters: { type: 'object', properties: {} },
    },
    execute: () => {
      const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
      const user = getUser();
      const latestWeight = getRecentWeightLogs(1)[0]?.weight ?? null;
      const target = calorieTargets({
        weightKg: latestWeight,
        heightCm: user?.heightCm ?? null,
        age: user?.age ?? null,
        sex: user?.sex ?? null,
        activityLevel: user?.activityLevel ?? null,
        goalType: user?.healthGoalType ?? null,
      });

      const entries = getFoodEntriesByDate(today);
      const consumed = entries.reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories ?? 0),
          protein: acc.protein + (e.protein ?? 0),
          carbs: acc.carbs + (e.carbs ?? 0),
          fat: acc.fat + (e.fat ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      const r = (n: number) => Math.round(n);

      return {
        goal: user?.healthGoalType ?? 'maintain',
        personalised: target.estimated,
        mealsLoggedToday: entries.length,
        target: { calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat },
        consumed: { calories: r(consumed.calories), protein: r(consumed.protein), carbs: r(consumed.carbs), fat: r(consumed.fat) },
        remaining: {
          calories: r(target.calories - consumed.calories),
          protein: r(target.protein - consumed.protein),
          carbs: r(target.carbs - consumed.carbs),
          fat: r(target.fat - consumed.fat),
        },
        note: target.estimated
          ? undefined
          : 'Target is a generic estimate — the user has not set their age/vitals. Suggest they add their age to personalise it.',
      };
    },
  };
}

/**
 * The tool set the voice assistant can call. It's the read-only `buildLifeOsTools`
 * set (goals, today's routine, recent sleep, gamification momentum, overdue
 * contacts) plus a finance spending summary and today's nutrition — so the voice
 * agent can ground its answers in the user's real data, exactly like the text
 * "what should I do next?" agent does. All tools are read-only and run on-device.
 */
export function buildVoiceTools(ctx: ToolContext): AgentTool[] {
  return [...buildLifeOsTools(ctx), recentSpendingTool(ctx), todayNutritionTool(ctx)];
}
