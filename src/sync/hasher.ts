/**
 * Production hasher for the mutation log. SHA-256 hex on both platforms.
 *
 * Native uses expo-crypto's digestStringAsync; web uses Web Crypto's
 * subtle.digest. Both produce the same hex output for the same input, so a
 * chain produced on web validates on native (sync foundation).
 */
import { Platform } from 'react-native';
import type { Hasher } from './hashChain';

let cached: Hasher | null = null;

export function getProductionHasher(): Hasher {
  if (cached) return cached;
  if (Platform.OS === 'web') {
    cached = async (input: string): Promise<string> => {
      const bytes = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return bufferToHex(digest);
    };
  } else {
    // expo-crypto is required dynamically so web bundles don't pull it in.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');
    cached = async (input: string): Promise<string> =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  }
  return cached;
}

function bufferToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0');
  }
  return out;
}
