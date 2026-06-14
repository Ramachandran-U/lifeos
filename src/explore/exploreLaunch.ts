/**
 * Pure seed builders for user-initiated exploration ("Dive vs Bridge").
 *
 * These turn a user's chosen interest(s) into the route params the rabbit-hole
 * screen already understands (app/rabbit-hole.tsx → RabbitHoleSeed). No I/O, no
 * navigation, no React — so they're trivially unit-testable; the launching hook
 * (useExploreLauncher) wires these to router.push + telemetry.
 *
 * - DIVE  = go deep on ONE interest (single-idea breadth + depth).
 * - BRIDGE = connect TWO interests (cross-discipline).
 *
 * The `sparkId` is a stable, synthetic id derived from the interest id(s), so
 * re-opening the same Dive/Bridge RESUMES its saved map (getRabbitHoleTreeBySpark)
 * instead of spawning a duplicate tree.
 */

export interface ExploreInterestRef {
  id: string;
  name: string;
}

/** Matches the inline-seed params read by app/rabbit-hole.tsx. The index
 * signature satisfies expo-router's UnknownInputParams for router.push. */
export interface RabbitHoleSeedParams {
  sparkId: string;
  seedTitle: string;
  seedBody: string;
  seedInterest: string;
  seedAdjacent: string;
  /** 'dive' (single-idea) or 'bridge' (cross) — drives sideways behaviour. */
  mode: string;
  [key: string]: string;
}

// The rabbit-hole tree contract requires the root body to be >= 20 chars
// (RabbitHoleNode Zod schema) or the tree fails to re-hydrate. Both builders
// below produce bodies comfortably past that floor.

/** Dive: a single-idea rabbit hole rooted on `interest`. */
export function buildDiveParams(interest: ExploreInterestRef): RabbitHoleSeedParams {
  return {
    sparkId: `interest-${interest.id}`,
    seedTitle: interest.name,
    seedBody: `Go deep on ${interest.name}: pull one thread and follow it down to the idea underneath.`,
    seedInterest: interest.name,
    seedAdjacent: '', // single-idea — "branch sideways" stays within the topic
    mode: 'dive',
  };
}

/** Bridge: a cross-discipline rabbit hole connecting interest `a` to interest `b`. */
export function buildBridgeParams(a: ExploreInterestRef, b: ExploreInterestRef): RabbitHoleSeedParams {
  return {
    sparkId: `bridge-${a.id}-${b.id}`,
    seedTitle: `${a.name} × ${b.name}`,
    seedBody: `Where do ${a.name} and ${b.name} meet? Find the structure they share and follow it across.`,
    seedInterest: a.name,
    seedAdjacent: b.name,
    mode: 'bridge',
  };
}
