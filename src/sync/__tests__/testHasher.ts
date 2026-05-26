import type { Hasher } from '../hashChain';

/**
 * Deterministic, dependency-free hash for tests. NOT cryptographic — it only
 * needs to be stable and collision-resistant enough to exercise chain logic.
 * Production wires expo-crypto's sha256 via the same Hasher interface.
 */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const testHasher: Hasher = async (input: string) => fnv1aHex(input);
