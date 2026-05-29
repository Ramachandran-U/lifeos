// Node-side stub for expo-crypto so eval/unit tests that import src/db/queries/aiSuggestions.ts
// (which uses Crypto.digestStringAsync) don't fail on the ESM `base64-js` import inside the
// real package. The eval harness runs in plain Node — see jest.config.js moduleNameMapper.

import { createHash, randomBytes } from 'crypto';

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA256',
  SHA1: 'SHA1',
  SHA512: 'SHA512',
  MD5: 'MD5',
} as const;

export async function digestStringAsync(
  _algorithm: string,
  data: string,
): Promise<string> {
  return createHash('sha256').update(data).digest('hex');
}

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(randomBytes(byteCount));
}
