/**
 * Encrypted backup / export / import (P1-T8).
 *
 * Export: gather ALL local data → JSON → encrypt (AES-256-GCM, see backupCrypto)
 * → write a `.lifeos.json` file the user saves wherever they want. This is the
 * "own your data" guarantee — and the only way sensitive local-only data
 * (health/finance/contacts) ever leaves the device, fully encrypted.
 *
 * Import: pick a file → decrypt with the passphrase → validate → apply locally.
 * GCM authenticates the ciphertext, so a wrong passphrase or any tamper throws
 * before anything is written (no partial/garbage restore). Apply is a per-row
 * UPSERT by primary key (INSERT OR REPLACE / localStorage set), NOT a wipe-first
 * restore: rows that exist locally but not in the backup are left in place. This
 * is deliberate — LifeOS is soft-delete + event-sourced, so importing an older
 * backup must never destroy data created since it was taken. The whole apply runs
 * in one transaction (native) / with rollback (web), so a mid-import failure
 * leaves the prior state intact rather than a half-restored DB.
 *
 * Sync-internal state (the hash-chained mutation_log + the pull cursor) is
 * deliberately NEITHER backed up NOR restored: re-injecting stale chain links or
 * an old cursor into a device that is actively syncing would desync it / replay
 * old mutations. That state rebuilds from the server.
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

// Sync-internal state is rebuilt from the server, never backed up or restored:
// re-importing an old mutation_log / pull cursor into an actively-syncing device
// would replay stale hash-chain links and rewind the cursor → desync. The web
// keys mirror sink.ts (WEB_KEY / WEB_CURSOR_KEY); the native names are the tables.
const SYNC_INTERNAL_TABLES = new Set(['mutation_log', 'sync_cursor']);
const SYNC_INTERNAL_WEB_KEYS = new Set(['lifeos_mutation_log', 'lifeos_sync_cursor']);

// ── gather (read-only) ───────────────────────────────────────────────────────
function gatherWeb(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('lifeos') && !SYNC_INTERNAL_WEB_KEYS.has(key)) {
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
  const allTables = (await db.getAllAsync(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  )) as { name: string }[];
  const out: Record<string, unknown[]> = {};
  for (const { name } of allTables) {
    if (SYNC_INTERNAL_TABLES.has(name)) continue; // excluded — see SYNC_INTERNAL_TABLES
    out[name] = (await db.getAllAsync(`SELECT * FROM "${name}"`)) as unknown[];
  }
  return out;
}

async function gatherBackup(): Promise<BackupPayload> {
  const data = Platform.OS === 'web' ? gatherWeb() : await gatherNative();
  return { app: 'lifeos', schema: 1, platform: Platform.OS, createdAt: new Date().toISOString(), data };
}

// ── apply (per-row UPSERT by PK; whole-apply is atomic) ──────────────────────
function applyWeb(data: Record<string, unknown>): void {
  // Skip sync-internal keys, then snapshot prior values so a mid-loop failure
  // rolls back to the pre-import state (localStorage has no transactions).
  const entries = Object.entries(data).filter(
    ([key, value]) => typeof value === 'string' && !SYNC_INTERNAL_WEB_KEYS.has(key),
  ) as [string, string][];
  const prior: [string, string | null][] = entries.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  } catch (e) {
    for (const [key, old] of prior) {
      if (old === null) localStorage.removeItem(key);
      else localStorage.setItem(key, old);
    }
    throw e;
  }
}

async function applyNative(data: Record<string, unknown>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync('lifeos.db');
  // One transaction for the whole import: any failure (bad row, constraint)
  // rolls the entire restore back rather than leaving a half-applied DB across
  // unrelated tables.
  await db.withTransactionAsync(async () => {
    for (const [table, rows] of Object.entries(data)) {
      if (SYNC_INTERNAL_TABLES.has(table) || !Array.isArray(rows)) continue;
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
  });
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
  // SDK 54: cacheDirectory / EncodingType / read+writeAsStringAsync live on the
  // `/legacy` entry now (removed from the package root). Use it so native file I/O
  // actually resolves at runtime.
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
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
  // SDK 54: cacheDirectory / EncodingType / read+writeAsStringAsync live on the
  // `/legacy` entry now (removed from the package root). Use it so native file I/O
  // actually resolves at runtime.
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
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
 * Pick a backup file, decrypt with the passphrase, validate, then apply locally
 * (per-row upsert by PK; sync-internal state excluded; atomic). Throws on a wrong
 * passphrase / tampered file (GCM). The caller MUST reload the app afterward
 * (in-memory stores are now stale).
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
