import type {
  ProfileSlotsPatch,
  UserProfile,
  ProfileSlotConfidence,
} from './types';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

function mergeStringArray(existing: string[], incoming?: string[]): string[] {
  if (!incoming) return existing;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [...existing, ...incoming]) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function applyConfidenceDeltas(
  current: ProfileSlotConfidence,
  deltas?: Partial<ProfileSlotConfidence>,
): ProfileSlotConfidence {
  const next: ProfileSlotConfidence = { ...current };
  if (!deltas) return computeOverall(next);
  for (const key of Object.keys(deltas) as (keyof ProfileSlotConfidence)[]) {
    const d = deltas[key];
    if (typeof d === 'number') next[key] = clamp((next[key] ?? 0) + d);
  }
  return computeOverall(next);
}

function computeOverall(c: ProfileSlotConfidence): ProfileSlotConfidence {
  // Weighted average — schedule and vision matter most for routine quality.
  const weights = {
    identity: 0.05,
    vision: 0.25,
    schedule: 0.25,
    chronotype: 0.1,
    habits: 0.1,
    constraints: 0.1,
    primaryDomains: 0.15,
  } as const;
  let sum = 0;
  for (const k of Object.keys(weights) as (keyof typeof weights)[]) {
    sum += (c[k] ?? 0) * weights[k];
  }
  return { ...c, overall: clamp(sum) };
}

/**
 * Mark one or more slots as user-verified — sets their confidence to 1.0 and
 * recomputes overall. Use this after any user-driven edit on the
 * "What LifeOS knows" screen so manual answers are weighted maximally.
 */
export function markSlotsUserVerified(
  profile: UserProfile,
  slots: Array<keyof Omit<ProfileSlotConfidence, 'overall'>>,
): UserProfile {
  const nextConfidence: ProfileSlotConfidence = { ...profile.confidence };
  for (const s of slots) nextConfidence[s] = 1;
  return {
    ...profile,
    confidence: computeOverall(nextConfidence),
    lastUpdated: new Date().toISOString(),
  };
}

export function mergeProfilePatch(profile: UserProfile, patch: ProfileSlotsPatch): UserProfile {
  const next: UserProfile = {
    ...profile,
    identity: { ...profile.identity, ...patch.identity },
    vision: {
      ...profile.vision,
      ...patch.vision,
      topGoals: mergeStringArray(profile.vision.topGoals, patch.vision?.topGoals).slice(0, 5),
    },
    schedule: {
      ...profile.schedule,
      ...patch.schedule,
      fixedBlocks: patch.schedule?.fixedBlocks
        ? [...profile.schedule.fixedBlocks, ...patch.schedule.fixedBlocks]
        : profile.schedule.fixedBlocks,
    },
    chronotype: patch.chronotype !== undefined ? patch.chronotype : profile.chronotype,
    primaryDomains: patch.primaryDomains
      ? Array.from(new Set([...profile.primaryDomains, ...patch.primaryDomains])).slice(0, 3)
      : profile.primaryDomains,
    habits: {
      current: mergeStringArray(profile.habits.current, patch.habits?.current),
      aspirational: mergeStringArray(profile.habits.aspirational, patch.habits?.aspirational),
    },
    constraints: mergeStringArray(profile.constraints, patch.constraints),
    struggles: mergeStringArray(profile.struggles, patch.struggles),
    values: mergeStringArray(profile.values, patch.values).slice(0, 5),
    communication: {
      tone: patch.communication?.tone !== undefined ? patch.communication.tone : profile.communication.tone,
      avoid: mergeStringArray(profile.communication.avoid, patch.communication?.avoid),
    },
    confidence: applyConfidenceDeltas(profile.confidence, patch.confidenceDeltas),
    lastUpdated: new Date().toISOString(),
  };
  return next;
}
