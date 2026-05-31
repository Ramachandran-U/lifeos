/**
 * Encrypted-backup crypto (P1-T8). AES-256-GCM with a PBKDF2-SHA256 key derived
 * from the user's passphrase. Pure (@noble/ciphers + @noble/hashes — audited,
 * zero native modules), so it runs identically on web + native AND is unit-
 * testable under jest.
 *
 * The envelope is self-describing (alg/kdf/iters) so a future parameter change
 * stays decryptable. GCM authenticates the ciphertext: a wrong passphrase or any
 * tamper makes decrypt() throw — there is no "silently wrong" decryption.
 *
 * The passphrase is never stored. If the user forgets it, the backup is
 * unrecoverable by design — the export UI must say so.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const KDF_ITERS = 150_000;
const SALT_LEN = 16;
const NONCE_LEN = 12; // 96-bit nonce, the GCM standard
const KEY_LEN = 32; // AES-256

export interface BackupEnvelope {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iters: number;
  /** hex */
  salt: string;
  /** hex */
  nonce: string;
  /** hex — ciphertext with the GCM tag appended */
  ct: string;
}

function deriveKey(passphrase: string, salt: Uint8Array, iters: number): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(passphrase), salt, { c: iters, dkLen: KEY_LEN });
}

/** Encrypt a plaintext string into a self-describing envelope. Fresh random
 *  salt + nonce every call, so the same input never produces the same bytes. */
export function encryptBackup(plaintext: string, passphrase: string): BackupEnvelope {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const key = deriveKey(passphrase, salt, KDF_ITERS);
  const ct = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iters: KDF_ITERS,
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ct: bytesToHex(ct),
  };
}

/** Decrypt an envelope. Throws (never returns garbage) on wrong passphrase or
 *  tamper — GCM auth fails closed. */
export function decryptBackup(env: BackupEnvelope, passphrase: string): string {
  const key = deriveKey(passphrase, hexToBytes(env.salt), env.iters);
  let pt: Uint8Array;
  try {
    pt = gcm(key, hexToBytes(env.nonce)).decrypt(hexToBytes(env.ct));
  } catch {
    throw new Error('Could not decrypt — wrong passphrase or corrupted backup.');
  }
  return new TextDecoder().decode(pt);
}
