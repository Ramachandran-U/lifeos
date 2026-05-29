/**
 * Process-wide MutationLog singleton.
 *
 * Lazy-init on first `recordMutation()` so we don't pay startup cost on cold
 * launch for users who never write. Init reads the device id, resolves the
 * authed user, asks the sink to resume the chain, and constructs the log.
 *
 * `recordMutation()` is fire-and-forget — never throws to the caller. This is
 * load-bearing: the mutation log is an observer of writes, never gating them.
 * If init or append fails, the primary write still succeeds and the user
 * notices nothing. Sync will backfill from primary state when it ships.
 */
import { useFlagStore } from '@/store/useFlagStore';
import { useUserStore } from '@/store/useUserStore';
import { getDeviceId } from '@/utils/telemetry';
import { MutationLog, type MutationInput } from './mutationLog';
import { getProductionHasher } from './hasher';
import { createLocalSink } from './sink';

let instance: MutationLog | null = null;
let initPromise: Promise<MutationLog | null> | null = null;
let disabled = false;
// Pending fire-and-forget writes. Production never reads this; tests await it
// to make non-deterministic settling deterministic.
const pending = new Set<Promise<void>>();

async function init(): Promise<MutationLog | null> {
  if (disabled) return null;
  if (!useFlagStore.getState().isEnabled('mutation_log_enabled')) {
    disabled = true;
    return null;
  }
  const userId = useUserStore.getState().userId;
  if (!userId) return null; // pre-signin writes are not logged

  const deviceId = await getDeviceId();
  const sink = createLocalSink();
  const resume = await sink.resume();
  instance = new MutationLog({
    hasher: getProductionHasher(),
    deviceId,
    userId,
    headHash: resume.headHash,
    initialLamport: resume.lamport,
    sink: sink.append,
  });
  return instance;
}

async function getLog(): Promise<MutationLog | null> {
  if (instance) return instance;
  if (initPromise) return initPromise;
  initPromise = init().catch(() => null);
  const result = await initPromise;
  // Allow re-init on a future call if init returned null because the user
  // wasn't signed in yet (most common case). Permanent kill is `disabled`.
  if (!result) initPromise = null;
  return result;
}

/**
 * Record a mutation. Fire-and-forget; safe to call from any write path. The
 * caller must NOT await this — primary writes proceed regardless.
 */
export function recordMutation(input: MutationInput): void {
  const p = (async () => {
    try {
      const log = await getLog();
      if (!log) return;
      await log.record(input);
    } catch {
      // Observer-only: never affect the primary write.
    }
  })();
  pending.add(p);
  void p.finally(() => pending.delete(p));
}

/**
 * Reset between tests. Not used in app code.
 */
export function _resetMutationLogForTests(): void {
  instance = null;
  initPromise = null;
  disabled = false;
}

/**
 * Wait for all in-flight mutations to settle. Tests only — production code
 * intentionally never awaits, since the log is observer-only.
 */
export async function _flushMutationLogForTests(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled(Array.from(pending));
  }
}
