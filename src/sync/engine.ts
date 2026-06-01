/**
 * Sync engine (P1-T5/T6).
 *
 * Drains the local mutation outbox to Supabase via the Worker (push) and folds
 * remote mutations back into local state (pull). A `drain()` does push then
 * pull; it runs on boot, on a 60s timer, and on return-to-foreground (native).
 *
 *  - push: read pending → POST /v1/sync/push → mark 'acked'. See pushPending.
 *  - pull: GET /v1/sync/pull since the server `seq` cursor → applyRemoteMutation
 *    (reducer.ts) → advance cursor. Conflict resolution is the pure fold in
 *    resolve.ts. Echo prevention: applied-remote rows are never re-pushed.
 *
 * Transport mirrors `src/ai/client.ts` exactly: {PROXY_URL}/v1/sync/* with the
 * user's Supabase bearer. The Worker forces user_id = jwt.sub, so the client
 * never has to be trusted with scoping.
 *
 * Safety contract (same as the mutation log): observer-only. Every entry point
 * is fire-and-forget and never throws to the caller. A failed push leaves the
 * records 'pending' to retry on the next drain; the server upsert is idempotent
 * so a double-push is harmless.
 *
 * Gating: no-ops unless BOTH `sync_engine_enabled` (remote kill switch) and
 * `mutation_log_enabled` are on AND a user is signed in. Off ⇒ zero behaviour.
 */
import { Platform, AppState } from 'react-native';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import { useSyncStore } from '@/store/useSyncStore';
import { withSpan } from '@/ai/tracing';
import { increment, gauge } from '@/observability/metrics';
import { getDeviceId } from '@/utils/telemetry';
import { getLocalSink } from './sink';
import { applyRemoteMutation } from './reducer';
import { planCompaction, COMMUTATIVE_ENTITIES } from './compaction';
import type { MutationRecord } from './mutationLog';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || 'http://localhost:8787';
/** Per-request batch size. Must stay ≤ the Worker's MAX_PUSH_BATCH (500). */
const PUSH_BATCH = 200;
/** Per-request pull size. Must stay ≤ the Worker's MAX_PULL_LIMIT (1000). */
const PULL_LIMIT = 500;
/** Periodic safety drain while the app is foregrounded. */
const DRAIN_INTERVAL_MS = 60_000;

function isEnabled(): boolean {
  const flags = useFlagStore.getState();
  return flags.isEnabled('sync_engine_enabled') && flags.isEnabled('mutation_log_enabled');
}

interface PushResult {
  pushed: number;
  skipped?: 'disabled' | 'signed_out' | 'busy';
}

interface PullResult {
  applied: number;
  skipped?: 'disabled' | 'signed_out' | 'busy';
}

/**
 * Compaction: only collapse an entity once it has at least this many log rows.
 * Set well above a normal active entity's lifetime row count so compaction is
 * rare and targets only genuinely heavy histories (e.g. gamification, which logs
 * on every XP change) — the goal is to bound pathological growth, not to churn
 * ordinary logs. Tune up if compaction runs too eagerly; down if the log still
 * grows unbounded for heavy users. Paired with COMPACT_RETAIN_DAYS (dormancy).
 */
const COMPACT_MIN_MUTATIONS = 50;
/** A document entity is "dormant" (safe to collapse) after this long. */
const COMPACT_RETAIN_DAYS = 30;

let started = false;
let draining = false;
let pulling = false;
let compactedThisSession = false;
let timer: ReturnType<typeof setInterval> | null = null;
// Structural type avoids depending on RN's AppState return-type name, which has
// drifted across versions (NativeEventSubscription / EventSubscription).
let appStateSub: { remove: () => void } | null = null;
// Web: drain when the tab becomes visible/focused (the web equivalent of the
// native AppState 'active' trigger).
let webVisibilityHandler: (() => void) | null = null;

async function postPush(token: string, mutations: MutationRecord[]): Promise<string[]> {
  const res = await fetch(`${PROXY_URL}/v1/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mutations }),
  });
  if (res.status === 429) {
    increment('sync.push.rate_limited');
    throw new Error('rate_limited');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`sync push ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as { acked?: string[] };
  return Array.isArray(data.acked) ? data.acked : [];
}

/**
 * Push all pending mutations, oldest-first, in batches until the outbox is
 * drained (or we hit a transient error / rate limit, in which case we stop and
 * the remainder retries on the next drain). Never throws.
 */
export async function pushPending(): Promise<PushResult> {
  if (!isEnabled()) return { pushed: 0, skipped: 'disabled' };
  if (!useUserStore.getState().userId) return { pushed: 0, skipped: 'signed_out' };
  if (draining) return { pushed: 0, skipped: 'busy' };

  draining = true;
  let pushed = 0;
  try {
    const token = await getSupabaseAccessToken();
    if (!token) return { pushed: 0, skipped: 'signed_out' };

    const sink = getLocalSink();
    return await withSpan('sync.push', async () => {
      // Drain loop: keep pushing full batches until a short (or empty) one.
      // Bounded by an iteration cap as a runaway backstop.
      for (let i = 0; i < 100; i++) {
        const pending = await sink.readPending(PUSH_BATCH);
        gauge('sync.outbox.depth', pending.length);
        if (pending.length === 0) break;

        try {
          const acked = await postPush(token, pending);
          await sink.markSynced(acked);
          pushed += acked.length;
          increment('sync.mutations.pushed', {}, acked.length);
        } catch {
          increment('sync.push.fail');
          // Stop draining on any push error; pending records retry next time.
          break;
        }

        if (pending.length < PUSH_BATCH) break; // outbox drained
      }
      increment('sync.push.ok');
      return { pushed };
    });
  } catch {
    increment('sync.push.fail');
    return { pushed };
  } finally {
    draining = false;
  }
}

async function fetchPull(
  token: string,
  since: number,
): Promise<{ mutations: MutationRecord[]; cursor: number }> {
  const res = await fetch(`${PROXY_URL}/v1/sync/pull?since=${since}&limit=${PULL_LIMIT}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    increment('sync.pull.rate_limited');
    throw new Error('rate_limited');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`sync pull ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as { mutations?: MutationRecord[]; cursor?: number };
  return {
    mutations: Array.isArray(data.mutations) ? data.mutations : [],
    cursor: typeof data.cursor === 'number' ? data.cursor : since,
  };
}

/**
 * Pull remote mutations since our cursor and fold them into local state. Pages
 * via the gap-free server `seq` cursor until caught up. Our own device's
 * records are skipped (already local); the reducer is idempotent regardless.
 * Never throws.
 */
export async function pullRemote(): Promise<PullResult> {
  if (!isEnabled()) return { applied: 0, skipped: 'disabled' };
  if (!useUserStore.getState().userId) return { applied: 0, skipped: 'signed_out' };
  if (pulling) return { applied: 0, skipped: 'busy' };

  pulling = true;
  let applied = 0;
  try {
    const token = await getSupabaseAccessToken();
    if (!token) return { applied: 0, skipped: 'signed_out' };

    const sink = getLocalSink();
    const myDevice = await getDeviceId();
    return await withSpan('sync.pull', async () => {
      for (let i = 0; i < 100; i++) {
        const since = await sink.getCursor();
        const { mutations, cursor } = await fetchPull(token, since);
        if (mutations.length === 0) break;

        for (const m of mutations) {
          if (m.deviceId === myDevice) continue; // our own write; already local
          const didApply = await applyRemoteMutation(m, sink);
          if (didApply) applied += 1;
        }

        // Advance only on forward progress, else stop (guards against a loop).
        if (cursor > since) await sink.setCursor(cursor);
        else break;
        if (mutations.length < PULL_LIMIT) break;
      }
      increment('sync.mutations.applied', {}, applied);
      increment('sync.pull.ok');
      // Reached the server cleanly → mark synced; bump the repaint signal only
      // if something actually changed.
      useSyncStore.getState().noteSynced();
      if (applied > 0) useSyncStore.getState().markApplied(applied);
      return { applied };
    });
  } catch {
    increment('sync.pull.fail');
    return { applied };
  } finally {
    pulling = false;
  }
}

/** Update the log-size gauge (ungated — the log grows whether or not sync is on). */
function gaugeLogSize(): void {
  void getLocalSink().count().then((n) => gauge('mutations.log.size', n)).catch(() => {});
}

/**
 * Bound the local log: collapse synced, commutative-or-dormant entities into
 * checkpoints (P1-T9). Flag-gated ('compaction', off) + once per session, since
 * it deletes rows. Independent of sync (the log grows from local writes too).
 * Never throws.
 */
async function maybeCompact(): Promise<void> {
  if (compactedThisSession) return;
  if (!useFlagStore.getState().isEnabled('compaction_enabled')) return;
  compactedThisSession = true;
  try {
    const sink = getLocalSink();
    const entries = await sink.readAllWithState();
    gauge('mutations.log.size', entries.length);
    const cutoff = new Date(Date.now() - COMPACT_RETAIN_DAYS * 86_400_000).toISOString();
    const plan = planCompaction(entries, {
      minMutations: COMPACT_MIN_MUTATIONS,
      retainCutoffTs: cutoff,
      commutative: COMMUTATIVE_ENTITIES,
    });
    if (plan.deleteIds.length === 0) return;
    await sink.applyCompaction(plan);
    increment('sync.compaction.collapsed', {}, plan.deleteIds.length);
    gauge('mutations.log.size', await sink.count());
  } catch {
    // best-effort — a failed compaction leaves the log intact
  }
}

/** Fire-and-forget drain (push then pull) — timer / foreground / boot trigger.
 *  Also drives the status pill, the log-size gauge, and (gated) compaction. */
function drain(): void {
  void (async () => {
    const store = useSyncStore.getState();
    if (isEnabled() && useUserStore.getState().userId) {
      store.setPhase('pushing');
      await pushPending();
      store.setPhase('pulling');
      await pullRemote(); // records lastSyncedAt on a successful round
      store.setPhase('idle');
    } else {
      store.setPhase(!isEnabled() ? 'disabled' : 'signed_out');
    }
    gaugeLogSize();
    void maybeCompact();
  })();
}

export const syncEngine = {
  /**
   * Begin draining: an initial pass, a periodic safety timer, and (native) a
   * foreground trigger. Idempotent — calling twice is a no-op.
   */
  start(): void {
    if (started) return;
    started = true;

    drain();

    timer = setInterval(drain, DRAIN_INTERVAL_MS);

    // Drain on return-to-foreground: native via AppState (mirrors
    // src/integrations/supabase/client.ts), web via the tab visibility event.
    if (Platform.OS !== 'web') {
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') drain();
      });
    } else if (typeof document !== 'undefined') {
      webVisibilityHandler = () => {
        if (document.visibilityState === 'visible') drain();
      };
      document.addEventListener('visibilitychange', webVisibilityHandler);
    }
  },

  /** Stop draining and release the timer + listener. */
  stop(): void {
    started = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (appStateSub) {
      appStateSub.remove();
      appStateSub = null;
    }
    if (webVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', webVisibilityHandler);
      webVisibilityHandler = null;
    }
  },

  /** Manually trigger a full sync (push then pull). */
  async flush(): Promise<{ pushed: number; applied: number }> {
    const push = await pushPending();
    const pull = await pullRemote();
    return { pushed: push.pushed, applied: pull.applied };
  },

  status(): { started: boolean; draining: boolean; pulling: boolean; enabled: boolean } {
    return { started, draining, pulling, enabled: isEnabled() };
  },
};

/** Test-only: reset module state between tests. */
export function _resetSyncEngineForTests(): void {
  if (timer) clearInterval(timer);
  if (appStateSub) appStateSub.remove();
  if (webVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', webVisibilityHandler);
  }
  started = false;
  draining = false;
  pulling = false;
  compactedThisSession = false;
  timer = null;
  appStateSub = null;
  webVisibilityHandler = null;
}
