import { format } from 'date-fns';
import type { AgentTool } from './runtime';
import type { ActionQueue, GoalStatus } from './actionQueue';

export interface WriteToolContext {
  /** yyyy-MM-dd. Injected for testability; defaults to today. */
  today?: string;
}

const GOAL_STATUSES: GoalStatus[] = ['active', 'completed', 'paused', 'abandoned'];

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Write tools for the agent's "act" capability. These NEVER mutate state — each
 * pushes a `ProposedAction` onto the queue and returns `{ proposed: true }` to
 * the model, so the agent reports what it intends and the UI asks the user to
 * confirm. Commit happens later via `commitActions` (actionQueue.ts).
 *
 * Refs (block / goal ids) come from the read tools (getTodayRoutine, getGoals),
 * which expose an opaque `ref` for exactly this purpose.
 */
export function buildLifeOsWriteTools(ctx: WriteToolContext, queue: ActionQueue): AgentTool[] {
  const today = ctx.today ?? format(new Date(), 'yyyy-MM-dd');

  return [
    {
      declaration: {
        name: 'proposeCreateRoutineBlock',
        description:
          'Propose adding a new routine block to the user\'s day. Does NOT create it — the user confirms first. Times are 24h "HH:MM".',
        parameters: {
          type: 'object',
          properties: {
            startTime: { type: 'string', description: '24h start time, e.g. "14:00".' },
            endTime: { type: 'string', description: '24h end time, e.g. "14:30".' },
            title: { type: 'string', description: 'Short title for the block.' },
            module: {
              type: 'string',
              description: 'One of: goal, health, finance, career, social, polymath.',
            },
            date: { type: 'string', description: 'yyyy-MM-dd. Defaults to today if omitted.' },
            notes: { type: 'string', description: 'Optional short note.' },
          },
          required: ['startTime', 'endTime', 'title', 'module'],
        },
      },
      execute: (args) => {
        const startTime = asString(args.startTime);
        const endTime = asString(args.endTime);
        const title = asString(args.title);
        const module = asString(args.module);
        if (!startTime || !endTime || !title || !module) {
          return { proposed: false, error: 'startTime, endTime, title and module are required' };
        }
        const date = asString(args.date) ?? today;
        const notes = asString(args.notes) ?? undefined;
        queue.propose({
          kind: 'createRoutineBlock',
          summary: `Add "${title}" (${startTime}–${endTime}, ${module})`,
          payload: { date, startTime, endTime, title, module, notes },
        });
        return { proposed: true };
      },
    },
    {
      declaration: {
        name: 'proposeCompleteBlock',
        description:
          "Propose marking a routine block complete. Does NOT change it — the user confirms first. `ref` is the block's ref from getTodayRoutine.",
        parameters: {
          type: 'object',
          properties: { ref: { type: 'string', description: 'Block ref from getTodayRoutine.' } },
          required: ['ref'],
        },
      },
      execute: (args) => {
        const ref = asString(args.ref);
        if (!ref) return { proposed: false, error: 'ref is required' };
        queue.propose({ kind: 'completeBlock', summary: 'Mark a block complete', payload: { ref } });
        return { proposed: true };
      },
    },
    {
      declaration: {
        name: 'proposeSkipBlock',
        description:
          "Propose marking a routine block skipped. Does NOT change it — the user confirms first. `ref` is the block's ref from getTodayRoutine.",
        parameters: {
          type: 'object',
          properties: { ref: { type: 'string', description: 'Block ref from getTodayRoutine.' } },
          required: ['ref'],
        },
      },
      execute: (args) => {
        const ref = asString(args.ref);
        if (!ref) return { proposed: false, error: 'ref is required' };
        queue.propose({ kind: 'skipBlock', summary: 'Mark a block skipped', payload: { ref } });
        return { proposed: true };
      },
    },
    {
      declaration: {
        name: 'proposeAdjustGoalStatus',
        description:
          "Propose changing a goal's status. Does NOT change it — the user confirms first. `ref` is the goal's ref from getGoals.",
        parameters: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Goal ref from getGoals.' },
            status: {
              type: 'string',
              description: 'One of: active, completed, paused, abandoned.',
            },
          },
          required: ['ref', 'status'],
        },
      },
      execute: (args) => {
        const ref = asString(args.ref);
        const status = asString(args.status) as GoalStatus | null;
        if (!ref) return { proposed: false, error: 'ref is required' };
        if (!status || !GOAL_STATUSES.includes(status)) {
          return { proposed: false, error: `status must be one of ${GOAL_STATUSES.join(', ')}` };
        }
        queue.propose({
          kind: 'adjustGoalStatus',
          summary: `Set a goal to "${status}"`,
          payload: { ref, status },
        });
        return { proposed: true };
      },
    },
  ];
}
