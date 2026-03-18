import * as Crypto from 'expo-crypto';

export function nanoid(): string {
  return Crypto.randomUUID();
}
