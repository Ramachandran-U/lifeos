/**
 * Backup crypto (P1-T8). Pure @noble — runs in jest, so the security-critical
 * core is actually verified here (round-trip + fail-closed on wrong key/tamper).
 */
import { encryptBackup, decryptBackup } from '../backupCrypto';

const PLAINTEXT = JSON.stringify({ goals: [{ id: 'g1', title: 'Run a 5k' }], xp: 1234 });
const PASS = 'correct horse battery staple';

describe('backup crypto', () => {
  test('round-trips plaintext through encrypt → decrypt', () => {
    const env = encryptBackup(PLAINTEXT, PASS);
    expect(env.alg).toBe('AES-256-GCM');
    expect(decryptBackup(env, PASS)).toBe(PLAINTEXT);
  });

  test('a wrong passphrase fails closed (throws, never returns garbage)', () => {
    const env = encryptBackup(PLAINTEXT, PASS);
    expect(() => decryptBackup(env, 'wrong passphrase')).toThrow();
  });

  test('tampered ciphertext fails the GCM auth check', () => {
    const env = encryptBackup(PLAINTEXT, PASS);
    // Flip the last hex nibble of the ciphertext.
    const last = env.ct.slice(-1);
    const flipped = (parseInt(last, 16) ^ 0x1).toString(16);
    const tampered = { ...env, ct: env.ct.slice(0, -1) + flipped };
    expect(() => decryptBackup(tampered, PASS)).toThrow();
  });

  test('fresh salt + nonce each call → same input never yields identical bytes', () => {
    const a = encryptBackup(PLAINTEXT, PASS);
    const b = encryptBackup(PLAINTEXT, PASS);
    expect(a.ct).not.toBe(b.ct);
    expect(a.salt).not.toBe(b.salt);
    expect(a.nonce).not.toBe(b.nonce);
    // ...but both still decrypt back to the same plaintext.
    expect(decryptBackup(a, PASS)).toBe(decryptBackup(b, PASS));
  });

  test('an empty passphrase is rejected', () => {
    expect(() => encryptBackup(PLAINTEXT, '')).toThrow();
  });
});
