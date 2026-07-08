import { format } from 'date-fns';
import { getGoalsByUser } from '@/db/queries/goals';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getLatestSleepHours } from '@/db/queries/health';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { getContactsByUser, computeOverdue } from '@/db/queries/social';
import { fetchTodayCalendarEvents } from '@/ai/calendarContext';
import { getUpcomingBillsForAgent } from '@/ai/billsContext';
import {
  searchFacts,
  getFactsByUser,
  isFactLive,
  effectiveSalience,
  relativeSince,
} from '@/ai/rag/memoryStore';
import { getRecentDaySummaries } from '@/db/queries/daySummaries';
import { buildSleepTrend, buildMoodTrend, buildCompletionTrend } from './trends';
import { useFlagStore } from '@/store/useFlagStore';
import type { AgentTool } from './runtime';

/**
 * The tabs the voice agent can navigate to. These map 1:1 to the routable
 * screens under app/(tabs)/ — 'today' is the index route. Kept here (the shared
 * tool-context module) so both the read tools and navTools reference one source.
 */
export type AppScreen =
  | 'today'
  | 'goals'
  | 'health'
  | 'finance'
  | 'career'
  | 'social'
  | 'explore'
  | 'life'
  | 'profile'
  | 'rewards';

export interface ToolContext {
  userId: string;
  /** yyyy-MM-dd. Injected for testability; defaults to today. */
  today?: string;
  /**
   * Navigate the app to a tab (optionally with query params to pre-fill a
   * screen). Supplied by the voice companion, which holds the expo-router
   * `router`. Only present when the agentic-voice tools are wired; the
   * read-only text agent leaves it undefined.
   */
  navigate?: (screen: AppScreen, params?: Record<string, string>) => void;
  /** The screen the user is currently on, so the agent knows its context. */
  currentScreen?: () => AppScreen;
}

const EMPTY_PARAMS = { type: 'object', properties: {} } as const;

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Builds the read-only tool set the "what should I do next?" agent can call,
 * bound to a specific user. Tools read local SQLite (and, for getTodayCalendar,
 * the connected Google Calendar) and return a compact, JSON-serialisable
 * summary — not raw rows, to keep token cost down. Goals and routine blocks
 * include an opaque `ref` (their id) so the write tools (see writeTools.ts) can
 * target a specific row when proposing an action.
 *
 * All tools here are READ-ONLY by design. The agent observes; it does not
 * mutate. Mutation only happens via propose-then-confirm — see writeTools.ts.
 */
/** Is the durable-memory tool enabled? Read at build time, per agent run. */
export function isMemoryToolEnabled(): boolean {
  try {
    return useFlagStore.getState().isEnabled('agent_memory_tool');
  } catch {
    return false;
  }
}

/**
 * Read-only durable-memory tool (flag `agent_memory_tool`, default off). Reads
 * the consolidation store behind "What LifeOS remembers": with a `topic` it
 * ranks facts by relevance (searchFacts); without one it returns the strongest
 * live facts by decayed salience. Compact rows only — never raw embeddings.
 */
function memoriesTool(userId: string): AgentTool {
  return {
    declaration: {
      name: 'getMemories',
      description:
        "LifeOS's durable long-term memory about the user: preferences, behaviour patterns, " +
        'milestones, and constraints distilled from weeks of history (beyond today\'s data). ' +
        'Use it to personalise recommendations — e.g. respect a known constraint, or lean on ' +
        'a pattern like "completes morning focus blocks". Pass `topic` to search memories ' +
        'relevant to a subject; omit it for the strongest overall memories.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Optional subject to search memories for (e.g. "workouts", "money habits").',
          },
        },
      },
    },
    execute: async (args) => {
      const now = Date.now();
      const toRow = (f: { kind: string; text: string; lastSeenAt: string }) => ({
        kind: f.kind,
        text: f.text,
        lastSeen: relativeSince(f.lastSeenAt, now),
      });
      if (typeof args.topic === 'string' && args.topic.trim()) {
        return (await searchFacts(userId, args.topic.trim(), 6, now)).map(toRow);
      }
      return getFactsByUser(userId)
        .filter((f) => isFactLive(f, now))
        .sort((a, b) => effectiveSalience(b, now) - effectiveSalience(a, now))
        .slice(0, 8)
        .map(toRow);
    },
  };
}

/** Are the temporal trend tools enabled? Read at build time, per agent run. */
export function isTrendToolsEnabled(): boolean {
  try {
    return useFlagStore.getState().isEnabled('agent_trend_tools');
  } catch {
    return false;
  }
}

const DAYS_PARAM = (fallback: number, what: string) => ({
  type: 'object' as const,
  properties: {
    days: { type: 'number', description: `How many days back to look at ${what}. Default ${fallback}.` },
  },
});

const clampDays = (v: unknown, fallback: number, max: number) =>
  Math.min(typeof v === 'number' && v > 0 ? Math.floor(v) : fallback, max);

/**
 * Read-only temporal trend tools (flag `agent_trend_tools`, default off) —
 * "how has my sleep/mood/completion trended?" plus narrative recall of recent
 * days from episodic memory. Pure local reads, compact JSON out.
 */
function trendTools(userId: string): AgentTool[] {
  return [
    {
      declaration: {
        name: 'getSleepTrend',
        description:
          "The user's sleep over time: per-date hours, the average, and whether it's trending " +
          'up, down, or flat. Use for "how has my sleep been?" and to justify a restorative ' +
          'recommendation with actual data instead of a single night.',
        parameters: DAYS_PARAM(14, 'sleep'),
      },
      execute: (args) => buildSleepTrend(clampDays(args.days, 14, 90)),
    },
    {
      declaration: {
        name: 'getMoodTrend',
        description:
          "The user's evening-reflection moods (1-5) over time: per-date values, the average, " +
          'and the direction of travel. Use for "how have I been feeling?" and to notice a ' +
          'slide the user may not have named.',
        parameters: DAYS_PARAM(14, 'mood'),
      },
      execute: (args) => buildMoodTrend(clampDays(args.days, 14, 90)),
    },
    {
      declaration: {
        name: 'getCompletionTrend',
        description:
          'Routine blocks completed per week over a recent window, with the direction across ' +
          'full weeks. Use for "am I doing more or less than before?" — momentum in numbers.',
        parameters: DAYS_PARAM(28, 'completed blocks'),
      },
      execute: (args) => buildCompletionTrend(clampDays(args.days, 28, 180)),
    },
    {
      declaration: {
        name: 'getRecentDays',
        description:
          'Narrative records of what the user\'s recent days were actually like (episodic ' +
          'memory): one factual paragraph per day plus mood and completion stats. Use for ' +
          '"what did last Tuesday look like?" or to ground advice in how the week really went. ' +
          'Empty when episodic memory is off or nothing is recorded yet.',
        parameters: DAYS_PARAM(7, 'day records'),
      },
      execute: async (args) => {
        const days = clampDays(args.days, 7, 30);
        const summaries = await getRecentDaySummaries(userId, days);
        return summaries.map((s) => ({
          date: s.date,
          summary: s.summary,
          mood: s.stats.mood,
          blocksCompleted: s.stats.blocksCompleted,
          blocksTotal: s.stats.blocksTotal,
        }));
      },
    },
  ];
}

export function buildLifeOsTools(ctx: ToolContext): AgentTool[] {
  const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
  const { userId } = ctx;

  const memory = isMemoryToolEnabled() ? [memoriesTool(userId)] : [];
  const trends = isTrendToolsEnabled() ? trendTools(userId) : [];

  return [
    ...memory,
    ...trends,
    {
      declaration: {
        name: 'getGoals',
        description:
          "The user's active goals. Returns title, domain, level (life/yearly/monthly/weekly/daily) and status.",
        parameters: EMPTY_PARAMS,
      },
      execute: () =>
        getGoalsByUser(userId)
          .filter((g) => g.status === 'active')
          .map((g) => ({
            ref: g.id,
            title: g.title,
            domain: g.goalType,
            level: g.level,
            status: g.status,
          })),
    },
    {
      declaration: {
        name: 'getTodayRoutine',
        description:
          "Today's planned routine blocks with their times, module, and completion status (upcoming/completed/skipped).",
        parameters: EMPTY_PARAMS,
      },
      execute: () =>
        getRoutineBlocksByDate(today).map((b) => ({
          ref: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          module: b.module,
          status: b.status,
        })),
    },
    {
      declaration: {
        name: 'getTodayCalendar',
        description:
          "Today's real fixed commitments from the user's connected Google Calendar " +
          '(meetings/events) with start and end times. Use this to avoid recommending an ' +
          'action that collides with a commitment, and to judge whether the user is free ' +
          'right now. Returns { connected, events }: events is empty when the day is clear; ' +
          'connected is false when no calendar is linked — in that case ignore it.',
        parameters: EMPTY_PARAMS,
      },
      execute: async () => {
        const events = await fetchTodayCalendarEvents();
        if (events === null) return { connected: false, events: [] };
        return {
          connected: true,
          events: events.map((e) => ({
            startTime: e.allDay ? 'all-day' : e.startTime,
            endTime: e.allDay ? 'all-day' : e.endTime,
            title: e.title,
            recurring: e.recurring,
          })),
        };
      },
    },
    {
      declaration: {
        name: 'getUpcomingBills',
        description:
          'Upcoming bills and subscription renewals detected from the user\'s email — ' +
          'anything due in the next week or already overdue, with amount and a relative ' +
          'due label. Use to surface a time-sensitive payment as the next action. Returns ' +
          '{ items }: empty when nothing is due or the data is unavailable (e.g. on native).',
        parameters: EMPTY_PARAMS,
      },
      execute: async () => ({ items: await getUpcomingBillsForAgent(today) }),
    },
    {
      declaration: {
        name: 'getRecentSleepHours',
        description:
          'Most recent sleep duration in hours within the last few days, or null if none logged.',
        parameters: {
          type: 'object',
          properties: {
            maxAgeDays: {
              type: 'number',
              description: 'How many days back to look for a sleep log. Default 3.',
            },
          },
        },
      },
      execute: (args) => {
        const maxAgeDays = typeof args.maxAgeDays === 'number' ? args.maxAgeDays : 3;
        return getLatestSleepHours(maxAgeDays);
      },
    },
    {
      declaration: {
        name: 'getMomentum',
        description:
          'The user\'s gamification momentum: per-domain scores (0-100), current streaks, and total XP.',
        parameters: EMPTY_PARAMS,
      },
      execute: () => {
        const g = getOrCreateGamification(userId);
        return {
          domainScores: safeParse<Record<string, number>>(g.domainScores, {}),
          streaks: safeParse<Record<string, { count: number; lastDate: string }>>(g.streaks, {}),
          totalXP: g.totalXP,
        };
      },
    },
    {
      declaration: {
        name: 'getOverdueContacts',
        description:
          'People the user is overdue to reconnect with, based on their preferred contact cadence.',
        parameters: EMPTY_PARAMS,
      },
      execute: () =>
        getContactsByUser(userId)
          .map((c) => ({ contact: c, overdue: computeOverdue(c) }))
          .filter(({ overdue }) => overdue.isOverdue)
          .map(({ contact, overdue }) => ({
            name: contact.name,
            overdueByDays: overdue.overdueBy,
          })),
    },
  ];
}
