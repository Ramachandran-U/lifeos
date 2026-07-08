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
import { getRoutineBlockById as dbGetRoutineBlockById } from '@/db/queries/routine';
import { updateGoalStatus as dbUpdateGoalStatus } from '@/db/queries/goals';
import { getGoalById as dbGetGoalById } from '@/db/queries/goals';
import { createFoodEntry as dbCreateFoodEntry, createHealthLog as dbCreateHealthLog } from '@/db/queries/health';
import { logInteraction as dbLogInteraction, getContact as dbGetContact, type InteractionType } from '@/db/queries/social';
import { createFinancialGoal as dbCreateFinancialGoal } from '@/db/queries/finance';
import { logDecisionEvent } from '@/db/queries/behaviour';

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
  | { kind: 'adjustGoalStatus'; summary: string; payload: { ref: string; status: GoalStatus } }
  // ── Logging writes (health / social) — committed via commitActions, like the
  // routine/goal writes above. These DO save on confirm (no navigation). ────────
  | {
      kind: 'logFood';
      summary: string;
      payload: {
        date: string;
        mealType: string;
        foodName: string;
        quantityG: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      };
    }
  | { kind: 'logWeight'; summary: string; payload: { date: string; weightKg: number } }
  | { kind: 'logContactInteraction'; summary: string; payload: { ref: string; type: string; notes?: string } }
  | {
      kind: 'setFinancialGoal';
      summary: string;
      payload: {
        title: string;
        goalType: string;
        targetAmount?: number;
        currency?: string;
        targetDate?: string;
        monthlySavings?: number;
      };
    }
  // ── Voice-agent navigation intents ──────────────────────────────────────────
  // These are proposed by the voice agent and, on confirm, are handled by the
  // companion: it navigates to the domain screen (or rabbit-hole) with the
  // collected inputs as params and lets that screen run its existing generate
  // flow (with its own loading UI). They are NOT committed through
  // `commitActions` — kicking off generation inside the commit would block the
  // spoken turn, and the screen already owns the loading/skeleton UX.
  // `commitActions` rejects them so a stray commit can't silently no-op.
  | { kind: 'createGoalFromVision'; summary: string; payload: { visionStatement: string } }
  | {
      kind: 'generateCareerPath';
      summary: string;
      payload: {
        currentRole: string;
        targetRole: string;
        timelineMonths: number;
        weeklyHours?: number;
        constraints?: string;
      };
    }
  | {
      kind: 'exploreIdea';
      summary: string;
      // Single-idea Dive on `topic`; cross-discipline Bridge if `bridgeWith` set.
      // On confirm the companion opens the Explore rabbit hole on it.
      payload: { topic: string; bridgeWith?: string };
    }
  // Routine re-plans are ~20s generations that run on the Today screen (its own
  // loading + diff UI) — nav intents, not commit writes. The companion navigates
  // to Today with an autorun param; commitActions rejects them.
  | { kind: 'replanToday'; summary: string; payload: Record<string, never> }
  | { kind: 'planAhead'; summary: string; payload: Record<string, never> };

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
  /** Does this routine block still exist? Re-checked at commit time. */
  routineBlockExists: (id: string) => boolean;
  /** Does this goal still exist? Re-checked at commit time. */
  goalExists: (id: string) => boolean;
  createFoodEntry: (data: {
    date: string;
    mealType: string;
    foodName: string;
    quantityG: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
  createHealthLog: (data: { date: string; weight: number }) => void;
  logContactInteraction: (data: { contactId: string; type: string; notes?: string }) => void;
  /** Does this contact still exist? Re-checked at commit time. */
  contactExists: (id: string) => boolean;
  createFinancialGoal: (data: {
    title: string;
    goalType: string;
    targetAmount?: number;
    currency?: string;
    targetDate?: string;
    monthlySavings?: number;
  }) => void;
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
  routineBlockExists: (id) => dbGetRoutineBlockById(id) != null,
  goalExists: (id) => dbGetGoalById(id) != null,
  createFoodEntry: (data) => {
    dbCreateFoodEntry(data);
  },
  createHealthLog: (data) => {
    dbCreateHealthLog(data);
  },
  logContactInteraction: (data) => {
    dbLogInteraction({ contactId: data.contactId, type: data.type as InteractionType, notes: data.notes });
  },
  contactExists: (id) => dbGetContact(id) != null,
  createFinancialGoal: (data) => {
    dbCreateFinancialGoal(data);
  },
};

/** User-facing reason a confirmed action couldn't be applied to a stale ref. */
export const STALE_REF_ERROR =
  "That item no longer exists — it may have changed since this was suggested.";

/**
 * Commit confirmed actions. Each action is independent: one failing (e.g. a
 * stale ref) does not abort the rest — it's reported in its own result.
 *
 * A proposal's `ref` (block/goal id) is captured when the agent runs, but the
 * user may confirm minutes later — after that row was edited or deleted on this
 * or another device. So ref-carrying actions are RE-VALIDATED against current
 * state here, immediately before mutating: a vanished ref fails loudly (the
 * card shows STALE_REF_ERROR) instead of silently no-op'ing an UPDATE that
 * matches zero rows and reporting success.
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
          if (!deps.routineBlockExists(action.payload.ref)) throw new Error(STALE_REF_ERROR);
          deps.updateRoutineBlockStatus(action.payload.ref, 'completed');
          break;
        case 'skipBlock':
          if (!deps.routineBlockExists(action.payload.ref)) throw new Error(STALE_REF_ERROR);
          deps.updateRoutineBlockStatus(action.payload.ref, 'skipped');
          break;
        case 'adjustGoalStatus':
          if (!deps.goalExists(action.payload.ref)) throw new Error(STALE_REF_ERROR);
          deps.updateGoalStatus(action.payload.ref, action.payload.status);
          break;
        case 'logFood':
          deps.createFoodEntry(action.payload);
          break;
        case 'logWeight':
          deps.createHealthLog({ date: action.payload.date, weight: action.payload.weightKg });
          break;
        case 'logContactInteraction':
          if (!deps.contactExists(action.payload.ref)) throw new Error(STALE_REF_ERROR);
          deps.logContactInteraction({
            contactId: action.payload.ref,
            type: action.payload.type,
            notes: action.payload.notes,
          });
          break;
        case 'setFinancialGoal':
          deps.createFinancialGoal(action.payload);
          break;
        case 'createGoalFromVision':
        case 'generateCareerPath':
        case 'exploreIdea':
        case 'replanToday':
        case 'planAhead':
          // Navigation intents are executed by the voice companion (navigate +
          // screen-driven generation), never here. Reaching this is a wiring bug.
          throw new Error(`${action.kind} is handled by navigation, not commitActions`);
      }
      results.push({ action, ok: true });
      // Decision log: confirming an AI proposal is a decision. Best-effort —
      // logging must never fail a commit the user just confirmed.
      try {
        logDecisionEvent('coach_action_confirmed', 'ai', {
          kind: action.kind,
          summary: action.summary.slice(0, 120),
        });
      } catch {
        /* observer-only */
      }
    } catch (err) {
      results.push({ action, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
