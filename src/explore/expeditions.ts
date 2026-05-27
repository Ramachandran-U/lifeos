/**
 * Multi-expedition engine (Explore v2, step 1) — PURE core.
 *
 * An expedition is a finite, ordered set of steps. A user can run several at
 * once; each has its own independent progress record, so advancing one never
 * touches another (no global "current expedition"). All operations are pure
 * functions over a progress value — storage + sync wiring is a thin adapter
 * built in a later increment.
 *
 * The merge function (`mergeExpeditionProgress`) is the conflict-free resolver
 * the sync spine will register for this entity: it must be commutative and
 * idempotent so two devices advancing the same expedition offline converge to
 * the union of their progress with zero steps lost. See
 * implementation-plan/phase-4-explore-sparks-expeditions.md §C5.
 */

export type ExpeditionStatus = 'active' | 'completed' | 'abandoned';
export type StepKind = 'read' | 'watch' | 'do' | 'reflect';

export interface ExpeditionStep {
  index: number; // 0-based
  title: string;
  kind: StepKind;
  prompt: string;
  estMinutes: number;
}

/** The journey definition — immutable once created (so it never conflicts on sync). */
export interface Expedition {
  id: string;
  userId: string;
  title: string;
  theme: string;
  domain: string; // 'polymath' by default
  steps: ExpeditionStep[];
  totalSteps: number;
  source: 'ai' | 'curated' | 'spark';
  seedSparkId: string | null;
  createdAt: string;
}

export interface ExpeditionProgress {
  id: string;
  userId: string;
  expeditionId: string;
  status: ExpeditionStatus;
  /** Furthest unlocked step index (0-based). */
  currentStep: number;
  /** Set of completed step indexes (kept sorted, de-duplicated). */
  completedSteps: number[];
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  updatedAt: string;
}

/** Max expeditions a user may have active at once (completion psychology). */
export const MAX_ACTIVE_EXPEDITIONS = 5;

export interface Clock {
  now: () => string; // ISO
  newId: () => string;
}

const sortedUnion = (a: number[], b: number[]): number[] =>
  [...new Set([...a, ...b])].sort((x, y) => x - y);

const maxIso = (a: string, b: string): string => (a >= b ? a : b);
const minIso = (a: string, b: string): string => (a <= b ? a : b);

/** Start a fresh progress record for an expedition the user just began. */
export function startExpedition(expeditionId: string, userId: string, clock: Clock): ExpeditionProgress {
  const now = clock.now();
  return {
    id: clock.newId(),
    userId,
    expeditionId,
    status: 'active',
    currentStep: 0,
    completedSteps: [],
    startedAt: now,
    lastActivityAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

/** Can the user start another expedition, given how many are currently active? */
export function canStartExpedition(activeCount: number, max = MAX_ACTIVE_EXPEDITIONS): boolean {
  return activeCount < max;
}

/**
 * Mark a step complete. Idempotent — completing the same step twice only bumps
 * timestamps. Unlocks the next step. Promotes to `completed` once every step in
 * 0..totalSteps-1 is done. Out-of-order completion is allowed (the set handles it).
 */
export function completeStep(
  progress: ExpeditionProgress,
  stepIndex: number,
  totalSteps: number,
  clock: Clock,
): ExpeditionProgress {
  if (stepIndex < 0 || stepIndex >= totalSteps) return progress; // ignore invalid
  if (progress.status === 'completed') return progress; // already done

  const now = clock.now();
  const completedSteps = sortedUnion(progress.completedSteps, [stepIndex]);
  const currentStep = Math.min(Math.max(progress.currentStep, stepIndex + 1), totalSteps);
  const allDone = completedSteps.length >= totalSteps;

  return {
    ...progress,
    status: allDone ? 'completed' : 'active',
    currentStep,
    completedSteps,
    lastActivityAt: now,
    completedAt: allDone ? now : progress.completedAt,
    updatedAt: now,
  };
}

/** Abandon an expedition (kept, not deleted — it can be resumed by completing a step). */
export function abandonExpedition(progress: ExpeditionProgress, clock: Clock): ExpeditionProgress {
  if (progress.status === 'completed') return progress;
  const now = clock.now();
  return { ...progress, status: 'abandoned', lastActivityAt: now, updatedAt: now };
}

export function progressFraction(progress: ExpeditionProgress, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return progress.completedSteps.length / totalSteps;
}

const STATUS_RANK: Record<ExpeditionStatus, number> = { abandoned: 0, active: 1, completed: 2 };

/**
 * Conflict-free merge of two progress records for the SAME (userId,
 * expeditionId). Commutative + idempotent. Never loses a completed step.
 *   - completedSteps → set union
 *   - currentStep    → max
 *   - status         → precedence completed > active > abandoned (a resume on
 *                      one device must not be lost to an abandon on another)
 *   - startedAt      → earliest
 *   - lastActivityAt / updatedAt → latest
 *   - completedAt    → set iff merged status is completed
 *   - id             → lexicographically smaller (deterministic tiebreak)
 */
export function mergeExpeditionProgress(a: ExpeditionProgress, b: ExpeditionProgress): ExpeditionProgress {
  const status: ExpeditionStatus = STATUS_RANK[a.status] >= STATUS_RANK[b.status] ? a.status : b.status;
  const completedAtCandidates = [a.completedAt, b.completedAt].filter((x): x is string => !!x);
  return {
    id: a.id <= b.id ? a.id : b.id,
    userId: a.userId,
    expeditionId: a.expeditionId,
    status,
    currentStep: Math.max(a.currentStep, b.currentStep),
    completedSteps: sortedUnion(a.completedSteps, b.completedSteps),
    startedAt: minIso(a.startedAt, b.startedAt),
    lastActivityAt: maxIso(a.lastActivityAt, b.lastActivityAt),
    completedAt: status === 'completed'
      ? (completedAtCandidates.length ? completedAtCandidates.reduce(maxIso) : maxIso(a.updatedAt, b.updatedAt))
      : null,
    updatedAt: maxIso(a.updatedAt, b.updatedAt),
  };
}
