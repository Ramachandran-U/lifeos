import { format } from 'date-fns';
import { getGoalsByUser } from '@/db/queries/goals';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getLatestSleepHours } from '@/db/queries/health';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { getContactsByUser, computeOverdue } from '@/db/queries/social';
import { fetchTodayCalendarEvents } from '@/ai/calendarContext';
import type { AgentTool } from './runtime';

export interface ToolContext {
  userId: string;
  /** yyyy-MM-dd. Injected for testability; defaults to today. */
  today?: string;
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
export function buildLifeOsTools(ctx: ToolContext): AgentTool[] {
  const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');
  const { userId } = ctx;

  return [
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
