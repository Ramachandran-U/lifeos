/**
 * Canonical serialization + hash chaining for the mutation log.
 *
 * Each mutation stores hash = H(prevHash + canonical(payload)). Chaining gives:
 *   - tamper evidence (any edit to history breaks every subsequent hash)
 *   - an O(1) "are two devices in sync" check (compare head hashes)
 *   - integrity validation before a restore or an import
 *
 * The hash function is injected (async) so this module stays platform-free:
 * production wires expo-crypto's digestStringAsync; tests pass a deterministic
 * fake. See phase-1-trust-foundation §B.1 / §B.5.
 */

export type Hasher = (input: string) => Promise<string>;

/**
 * Deterministic, order-independent-for-keys JSON serialization. Object keys are
 * sorted recursively so that {a:1,b:2} and {b:2,a:1} hash identically; arrays
 * preserve order (order is semantic). undefined is dropped; functions/symbols
 * are not expected in mutation payloads and are rejected by JSON.stringify.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortDeep);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] === undefined) continue;
    out[key] = sortDeep(obj[key]);
  }
  return out;
}

/** Compute the next chain hash from the previous head and a payload object. */
export async function chainHash(
  prevHash: string | null,
  payload: unknown,
  hash: Hasher,
): Promise<string> {
  return hash((prevHash ?? '') + canonicalize(payload));
}

/**
 * Validate a contiguous, lamport-ordered slice of a hash chain. Returns the
 * index of the first broken link, or -1 if the chain is intact. Used before
 * restore/import to refuse operating on corrupted history.
 */
export async function validateChain(
  entries: ReadonlyArray<{ prevHash: string | null; hash: string; payload: unknown }>,
  hash: Hasher,
): Promise<number> {
  let expectedPrev: string | null = entries.length > 0 ? entries[0]!.prevHash : null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.prevHash !== expectedPrev) return i;
    const computed = await chainHash(e.prevHash, e.payload, hash);
    if (computed !== e.hash) return i;
    expectedPrev = e.hash;
  }
  return -1;
}
