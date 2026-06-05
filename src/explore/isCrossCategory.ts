/**
 * Cross-category ("synapse") test, shared by the constellation projection and
 * the rabbit-hole synapse scoring/feed so the two never drift. A synapse is the
 * prestige signal: a link between two interests in DIFFERENT categories.
 *
 * Also the canonical constellation node-id scheme, kept here (a leaf module) so
 * both constellation.ts and rabbitHoleConstellation.ts mint identical ids — a
 * rabbit-hole synapse edge between two interests must collapse onto the same
 * edge the spark projection would create.
 */

export interface CategorizedInterest {
  name: string;
  category: string;
}

/** Normalize an interest/label name for matching + id minting. */
export const normInterest = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

export const interestNodeId = (name: string): string => `interest:${normInterest(name)}`;
export const conceptNodeId = (label: string): string => `concept:${normInterest(label)}`;

/** Category of a (possibly messy) interest name, or undefined if untracked. */
export function categoryOf(name: string, interests: readonly CategorizedInterest[]): string | undefined {
  const key = normInterest(name);
  if (!key) return undefined;
  return interests.find((i) => normInterest(i.name) === key)?.category;
}

/** True iff both names resolve to tracked interests in DIFFERENT categories. */
export function isCrossCategory(a: string, b: string, interests: readonly CategorizedInterest[]): boolean {
  return crossCategoryPair(a, b, interests) !== null;
}

/** The sorted "catA|catB" synapse-pair key when cross-category, else null. */
export function crossCategoryPair(a: string, b: string, interests: readonly CategorizedInterest[]): string | null {
  const ca = categoryOf(a, interests);
  const cb = categoryOf(b, interests);
  if (ca === undefined || cb === undefined || ca === cb) return null;
  return [ca, cb].sort().join('|');
}
