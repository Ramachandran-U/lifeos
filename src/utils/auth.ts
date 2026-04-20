import * as Crypto from 'expo-crypto';

export async function generateSalt(): Promise<string> {
  const random = Crypto.getRandomBytes(16);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + password,
  );
}

export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}
