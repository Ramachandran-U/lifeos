import { useCallback, useState } from 'react';
import { whatShouldIDoNext } from '@/ai/agent/whatNext';

export type WhatNextStatus = 'idle' | 'loading' | 'done' | 'error';

export interface UseWhatNextResult {
  status: WhatNextStatus;
  answer: string | null;
  error: string | null;
  /** Run the agent. No-ops while a run is already in flight. */
  run: () => Promise<void>;
  /** Reset back to idle (e.g. to collapse the answer). */
  reset: () => void;
}

/**
 * Thin state wrapper around the `whatShouldIDoNext` agent for the Today-screen
 * card. The agent itself (and its tool loop) is unit-tested in
 * src/ai/__tests__/whatNextAgent.test.ts; this hook only manages UI state.
 */
export function useWhatNext(userId: string | null): UseWhatNextResult {
  const [status, setStatus] = useState<WhatNextStatus>('idle');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!userId || status === 'loading') return;
    setStatus('loading');
    setError(null);
    try {
      const result = await whatShouldIDoNext({ userId });
      setAnswer(result.answer);
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
  }, []);

  return { status, answer, error, run, reset };
}
