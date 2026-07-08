import { useCallback, useRef, useState } from 'react';
import { whatShouldIDoNextWithActions } from '@/ai/agent/whatNext';
import { commitActions, type ProposedAction } from '@/ai/agent/actionQueue';
import { logDecisionEvent } from '@/db/queries/behaviour';

export type CoachStatus = 'idle' | 'loading' | 'done' | 'error';

/** Per-proposal lifecycle in the confirm card. */
export type ProposalState = 'pending' | 'committing' | 'done' | 'failed' | 'dismissed';

export interface ProposalView {
  action: ProposedAction;
  state: ProposalState;
  error?: string;
}

export interface UseCoachActionsResult {
  status: CoachStatus;
  answer: string | null;
  error: string | null;
  proposals: ProposalView[];
  /** Run the agent. No-ops while a run is already in flight. */
  run: () => Promise<void>;
  /** Back to idle (collapse the card). */
  reset: () => void;
  /** Commit a single proposal (maps to an existing DB query → recordMutation). */
  confirm: (index: number) => Promise<void>;
  /** Drop a proposal without acting on it. */
  dismiss: (index: number) => void;
}

/**
 * State wrapper around the propose-capable `whatShouldIDoNextWithActions` agent.
 * The agent NEVER mutates — it returns confirmable `ProposedAction`s; only
 * `confirm` calls `commitActions`, which maps each proposal to an existing DB
 * query (so the sync/audit layer keeps working). "Always confirm" holds by
 * construction. Gated by `ai_coach_actions` at the card; this hook is pure
 * presentation state.
 */
export function useCoachActions(userId: string | null): UseCoachActionsResult {
  const [status, setStatus] = useState<CoachStatus>('idle');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalView[]>([]);

  // Mirror the latest proposals so the async confirm() reads a fresh value
  // rather than a stale closure (the role refs play in event-driven hooks).
  const proposalsRef = useRef<ProposalView[]>([]);
  proposalsRef.current = proposals;

  const patch = useCallback((index: number, next: Partial<ProposalView>) => {
    setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, ...next } : p)));
  }, []);

  const run = useCallback(async () => {
    if (!userId || status === 'loading') return;
    setStatus('loading');
    setError(null);
    setAnswer(null);
    setProposals([]);
    try {
      const result = await whatShouldIDoNextWithActions({ userId });
      setAnswer(result.answer);
      setProposals(result.proposedActions.map((action) => ({ action, state: 'pending' as const })));
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not work that out right now.');
      setStatus('error');
    }
  }, [userId, status]);

  const reset = useCallback(() => {
    setStatus('idle');
    setAnswer(null);
    setError(null);
    setProposals([]);
  }, []);

  const confirm = useCallback(
    async (index: number) => {
      const target = proposalsRef.current[index];
      if (!target || target.state !== 'pending') return; // ignore double-taps / non-pending
      patch(index, { state: 'committing' });
      try {
        const [res] = await commitActions([target.action]);
        patch(index, res?.ok ? { state: 'done' } : { state: 'failed', error: res?.error });
      } catch (err) {
        patch(index, {
          state: 'failed',
          error: err instanceof Error ? err.message : 'Could not apply that.',
        });
      }
    },
    [patch],
  );

  const dismiss = useCallback(
    (index: number) => {
      // Decision log: skipping a proposal is as much a decision as confirming
      // one — the "no" the coach should eventually learn from. (Confirms are
      // logged in commitActions, the commit point shared with voice.)
      const target = proposalsRef.current[index];
      if (target && target.state === 'pending') {
        try {
          logDecisionEvent('coach_action_skipped', 'ai', {
            kind: target.action.kind,
            summary: target.action.summary.slice(0, 120),
          });
        } catch {
          /* observer-only */
        }
      }
      patch(index, { state: 'dismissed' });
    },
    [patch],
  );

  return { status, answer, error, proposals, run, reset, confirm, dismiss };
}
