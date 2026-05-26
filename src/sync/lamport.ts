/**
 * Lamport logical clock — the authoritative ordering for mutations.
 *
 * Wall-clock timestamps cannot be trusted across devices (skew, wrong tz,
 * manual changes). A Lamport clock gives a monotonic logical time that, paired
 * with a stable deviceId tiebreak, yields a deterministic total order on
 * mutations regardless of physical clocks. See phase-1-trust-foundation §B.1.
 */
export class LamportClock {
  private value: number;

  constructor(initial = 0) {
    if (!Number.isInteger(initial) || initial < 0) {
      throw new RangeError(`LamportClock initial must be a non-negative integer, got ${initial}`);
    }
    this.value = initial;
  }

  /** Current logical time without advancing. */
  get current(): number {
    return this.value;
  }

  /** Advance for a local event and return the new time. */
  tick(): number {
    this.value += 1;
    return this.value;
  }

  /**
   * Fold in a logical time observed from a remote mutation. After observing,
   * the next local tick is guaranteed to be greater than anything seen so far.
   */
  observe(remote: number): void {
    if (!Number.isInteger(remote) || remote < 0) return; // ignore garbage, never go backwards
    if (remote > this.value) this.value = remote;
  }
}

/**
 * Total-order comparison for two mutations. Lamport time first, deviceId as a
 * deterministic tiebreak when logical times collide (concurrent edits).
 * Returns <0 if A precedes B, >0 if A follows B, 0 only if identical.
 */
export function compareLamport(
  a: { lamport: number; deviceId: string },
  b: { lamport: number; deviceId: string },
): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}
