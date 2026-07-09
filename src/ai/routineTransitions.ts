/**
 * Transition realism checks for generated routines — pure, deterministic.
 *
 * A plan that stacks a workout hard against a deep-work block, or leaves zero
 * minutes to change clothes / sit down / commute, reads as machine-made. The
 * prompts (routine.ts rule 15, planner propose/critique) state these rules;
 * this module is the ground truth the critique step is handed, so the reviewer
 * model corrects concrete named violations instead of vibing.
 *
 * Used by src/ai/agent/planner.ts (deterministic issues → critique input).
 * Pure + exported for unit tests.
 */

export interface TransitionBlock {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
  module: string;
  /** Plain string to match GeneratedRoutineSchema's block shape — the model
   *  occasionally emits variants; only 'high'|'medium'|'low' are meaningful. */
  energyRequired?: string | null;
}

export interface TransitionOptions {
  /** Minimum gap between consecutive demanding blocks. Default 10. */
  transitionMinutes?: number | null;
  /** One-way commute; > 0 means commute blocks belong around work. */
  commuteMinutes?: number | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
}

export const DEFAULT_TRANSITION_MINUTES = 10;
/** Physical → focused needs more than a generic breather (shower, change). */
export const POST_PHYSICAL_BUFFER_MINUTES = 20;

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const isDemanding = (b: TransitionBlock): boolean =>
  b.energyRequired === 'high' || b.energyRequired === 'medium';

/** Physical exertion the user needs to shower/change after. */
const isPhysical = (b: TransitionBlock): boolean =>
  b.module === 'health' && b.energyRequired !== 'low';

const isRestful = (b: TransitionBlock): boolean =>
  b.module === 'rest' || b.module === 'meal';

const looksLikeCommute = (b: TransitionBlock): boolean =>
  /commute|travel to|drive to|train to|bus to/i.test(b.title);

/**
 * Named violations of the transition rules, one human-readable string each —
 * the exact shape the critique prompt consumes. Empty array = clean plan.
 */
export function findTransitionIssues(
  blocks: TransitionBlock[],
  opts: TransitionOptions = {},
): string[] {
  const issues: string[] = [];
  const minGap = opts.transitionMinutes ?? DEFAULT_TRANSITION_MINUTES;
  const ordered = [...blocks].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

  // Physical block flowing into demanding non-rest work: no time to
  // shower/change. A rest/meal block IS the buffer. Scans FORWARD past any
  // in-between neutral blocks (e.g. a 3-min "log workout") so a tiny
  // interstitial can't hide a real workout→deep-work collision — the gap is
  // measured from the physical block's end to the first checkpoint block
  // found, whatever sits between them. Tracks genuinely adjacent pairs it
  // has already ruled on so the context-switch pass below doesn't re-flag
  // the same transition.
  const physicalBufferHandledAdjacent = new Set<number>();
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i]!;
    if (!isPhysical(cur)) continue;
    for (let j = i + 1; j < ordered.length; j++) {
      const candidate = ordered[j]!;
      const gap = toMin(candidate.startTime) - toMin(cur.endTime);
      if (gap < 0) continue; // overlap — the schedule guards own that class; keep scanning past it
      if (isRestful(candidate)) break; // buffer satisfied
      if (isPhysical(candidate)) break; // a newer physical block resets the clock — its own scan covers what follows
      if (isDemanding(candidate)) {
        if (gap < POST_PHYSICAL_BUFFER_MINUTES) {
          issues.push(
            `"${candidate.title}" starts ${gap} min after the physical block "${cur.title}" — leave ≥${POST_PHYSICAL_BUFFER_MINUTES} min to shower/change, or insert a rest block.`,
          );
          if (j === i + 1) physicalBufferHandledAdjacent.add(i);
        }
        break; // found the checkpoint either way — stop scanning for this physical block
      }
      // neutral block (not physical/restful/demanding) — keep scanning forward
    }
  }

  // Two demanding blocks in different modules back-to-back with no breather.
  for (let i = 0; i < ordered.length - 1; i++) {
    if (physicalBufferHandledAdjacent.has(i)) continue;
    const cur = ordered[i]!;
    const next = ordered[i + 1]!;
    const gap = toMin(next.startTime) - toMin(cur.endTime);
    if (gap < 0) continue; // overlap — the schedule guards own that class

    if (
      minGap > 0 &&
      isDemanding(cur) &&
      isDemanding(next) &&
      cur.module !== next.module &&
      !isRestful(cur) &&
      !isRestful(next) &&
      gap < minGap
    ) {
      issues.push(
        `"${cur.title}" → "${next.title}" is a hard context switch (${cur.module}→${next.module}) with only ${gap} min between — leave ≥${minGap} min or insert a short rest block.`,
      );
    }
  }

  // Commute coverage: when the user commutes, the plan must actually book it —
  // either a fixedBlock the model echoed, or generated commute blocks — in the
  // windows before workStartTime and after workEndTime.
  const commute = opts.commuteMinutes ?? 0;
  if (commute > 0 && opts.workStartTime && opts.workEndTime) {
    const workStart = toMin(opts.workStartTime);
    const workEnd = toMin(opts.workEndTime);
    const coversCommuteBefore = ordered.some(
      (b) => looksLikeCommute(b) && toMin(b.endTime) <= workStart && toMin(b.endTime) >= workStart - commute - 15,
    );
    const coversCommuteAfter = ordered.some(
      (b) => looksLikeCommute(b) && toMin(b.startTime) >= workEnd && toMin(b.startTime) <= workEnd + 15,
    );
    if (!coversCommuteBefore) {
      issues.push(
        `The user commutes ${commute} min each way but no commute block ends at work start (${opts.workStartTime}) — book "Commute to work" ending exactly then.`,
      );
    }
    if (!coversCommuteAfter) {
      issues.push(
        `No commute-home block starts at work end (${opts.workEndTime}) — book "Commute home" starting then; nothing else can occupy that window.`,
      );
    }
  }

  return issues;
}
