/**
 * Encrypted backup / export / import (P1-T8).
 *
 * Export: gather ALL local data → JSON → encrypt (AES-256-GCM, see backupCrypto)
 * → write a `.lifeos.json` file the user saves wherever they want. This is the
 * "own your data" guarantee — and the only way sensitive local-only data
 * (health/finance/contacts) ever leaves the device, fully encrypted.
 *
 * Import: pick a file → decrypt with the passphrase → validate → OVERWRITE local
 * data. GCM authenticates the ciphertext, so a wrong passphrase or any tamper
 * throws before anything is written (no partial/garbage restore).
 *
 * Backups are platform-specific (web dumps localStorage keys; native dumps
 * SQLite tables), so import refuses a backup from the other platform.
 *
 * Native modules are lazy-required so the web bundle never pulls expo-file-system
 * et al., and the web DOM paths are guarded by Platform.OS.
 */
import { Platform } from 'react-native';
import { encryptBackup, decryptBackup, type BackupEnvelope } from './backupCrypto';

interface BackupPayload {
  app: 'lifeos';
  schema: 1;
  platform: string;
  createdAt: string;
  /** web: { localStorageKey: rawString }. native: { tableName: rows[] }. */
  data: Record<string, unknown>;
}

// ── gather (read-only) ───────────────────────────────────────────────────────
function gatherWeb(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('lifeos')) {
      const v = localStorage.getItem(key);
      if (v !== null) out[key] = v;
    }
  }
  return out;
}

async function gatherNative(): Promise<Record<string, unknown[]>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync('lifeos.db');
  const tables = (await db.getAllAsync(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  )) as { name: string }[];
  const out: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    out[name] = (await db.getAllAsync(`SELECT * FROM "${name}"`)) as unknown[];
  }
  return out;
}

async function gatherBackup(): Promise<BackupPayload> {
  const data = Platform.OS === 'web' ? gatherWeb() : await gatherNative();
  return { app: 'lifeos', schema: 1, platform: Platform.OS, createdAt: new Date().toISOString(), data };
}

// ── apply (DESTRUCTIVE — overwrites local data) ──────────────────────────────
function applyWeb(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') localStorage.setItem(key, value);
  }
}

async function applyNative(data: Record<string, unknown>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync('lifeos.db');
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows as Record<string, unknown>[]) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      const colList = cols.map((c) => `"${c}"`).join(',');
      const placeholders = cols.map(() => '?').join(',');
      await db.runAsync(
        `INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${placeholders})`,
        cols.map((c) => row[c] as never),
      );
    }
  }
}

// ── file I/O ─────────────────────────────────────────────────────────────────
async function writeAndShare(json: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save your LifeOS backup' });
  }
}

function pickWebFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

async function pickAndRead(): Promise<string | null> {
  if (Platform.OS === 'web') return pickWebFile();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  return FileSystem.readAsStringAsync(res.assets[0].uri);
}

// ── public API ───────────────────────────────────────────────────────────────

/** Gather + encrypt + write/share an encrypted backup file. Non-destructive. */
export async function exportBackup(passphrase: string): Promise<void> {
  const payload = await gatherBackup();
  const envelope = encryptBackup(JSON.stringify(payload), passphrase);
  const filename = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.lifeos.json`;
  await writeAndShare(JSON.stringify(envelope), filename);
}

export interface ImportResult {
  applied: boolean;
  reason?: 'cancelled' | 'wrong_platform' | 'invalid_file';
}

/**
 * Pick a backup file, decrypt with the passphrase, validate, then OVERWRITE
 * local data. Throws on a wrong passphrase / tampered file (GCM). The caller
 * MUST reload the app afterward (in-memory stores are now stale).
 */
export async function importBackup(passphrase: string): Promise<ImportResult> {
  const raw = await pickAndRead();
  if (raw == null) return { applied: false, reason: 'cancelled' };

  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(raw) as BackupEnvelope;
    if (envelope.alg !== 'AES-256-GCM' || !envelope.ct) throw new Error('not a backup');
  } catch {
    return { applied: false, reason: 'invalid_file' };
  }

  // Throws (caught by the caller) on wrong passphrase / tamper — before any write.
  const payload = JSON.parse(decryptBackup(envelope, passphrase)) as BackupPayload;
  if (payload.app !== 'lifeos' || typeof payload.data !== 'object') {
    return { applied: false, reason: 'invalid_file' };
  }
  if (payload.platform !== Platform.OS) {
    return { applied: false, reason: 'wrong_platform' };
  }

  if (Platform.OS === 'web') applyWeb(payload.data);
  else await applyNative(payload.data);

  return { applied: true };
}
