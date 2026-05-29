/**
 * Propose-then-commit action layer for the agent's "act" capability.
 *
 * The agent NEVER mutates state directly. Write tools (see writeTools.ts) push
 * a `ProposedAction` onto a queue and return `{ proposed: true }` to the model.
 * The UI renders each proposal as a confirmable card; only on explicit user
 * confirmation does `commitActions` run, mapping each proposal to an EXISTING
 * DB query (which already calls `recordMutation`, so the audit/sync layer keeps
 * working). This guarantees "always confirm" by construction — no tool can
 * touch the DB.
 */

import { createRoutineBlock as dbCreateRoutineBlock } from '@/db/queries/routine';
import { updateRoutineBlockStatus as dbUpdateRoutineBlockStatus } from '@/db/queries/routine';
import { updateGoalStatus as dbUpdateGoalStatus } from '@/db/queries/goals';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export type ProposedAction =
  | {
      kind: 'createRoutineBlock';
      summary: string;
      payload: {
        date: string;
        startTime: string;
        endTime: string;
        title: string;
        module: string;
        notes?: string;
      };
    }
  | { kind: 'completeBlock'; summary: string; payload: { ref: string } }
  | { kind: 'skipBlock'; summary: string; payload: { ref: string } }
  | { kind: 'adjustGoalStatus'; summary: string; payload: { ref: string; status: GoalStatus } };

export interface ActionQueue {
  propose(action: ProposedAction): void;
  list(): ProposedAction[];
}

/** A per-run, in-memory queue of proposed (not yet committed) actions. */
export function createActionQueue(): ActionQueue {
  const actions: ProposedAction[] = [];
  return {
    propose: (action) => {
      actions.push(action);
    },
    list: () => actions.slice(),
  };
}

export interface CommitResult {
  action: ProposedAction;
  ok: boolean;
  error?: string;
}

/**
 * The real write paths, injectable for tests. Defaults are the live DB queries
 * (each of which records a mutation for the sync/audit layer).
 */
export type CreateRoutineBlockData = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  notes?: string;
};

export interface CommitDeps {
  createRoutineBlock: (data: CreateRoutineBlockData) => void;
  updateRoutineBlockStatus: (id: string, status: string) => void;
  updateGoalStatus: (id: string, status: string) => void;
}

const defaultDeps: CommitDeps = {
  createRoutineBlock: (data) => {
    dbCreateRoutineBlock(data);
  },
  updateRoutineBlockStatus: (id, status) => {
    dbUpdateRoutineBlockStatus(id, status);
  },
  updateGoalStatus: (id, status) => {
    dbUpdateGoalStatus(id, status);
  },
};

/**
 * Commit confirmed actions. Each action is independent: one failing (e.g. a
 * stale block ref) does not abort the rest — it's reported in its own result.
 */
export async function commitActions(
  actions: ProposedAction[],
  deps: CommitDeps = defaultDeps,
): Promise<CommitResult[]> {
  const results: CommitResult[] = [];
  for (const action of actions) {
    try {
      switch (action.kind) {
        case 'createRoutineBlock':
          deps.createRoutineBlock(action.payload);
          break;
        case 'completeBlock':
          deps.updateRoutineBlockStatus(action.payload.ref, 'completed');
          break;
        case 'skipBlock':
          deps.updateRoutineBlockStatus(action.payload.ref, 'skipped');
          break;
        case 'adjustGoalStatus':
          deps.updateGoalStatus(action.payload.ref, action.payload.status);
          break;
      }
      results.push({ action, ok: true });
    } catch (err) {
      results.push({ action, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
