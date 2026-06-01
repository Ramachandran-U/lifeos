/**
 * Local sink for the mutation log. Persists records and exposes:
 *  - `resume`      — load the chain head + last lamport so the in-memory
 *                    MutationLog picks up where the previous session left off.
 *  - `append`      — write one new local mutation (sync_state defaults 'pending').
 *  - `readPending` — the sync outbox: pending records oldest-first (P1-T5 push).
 *  - `markSynced`  — flip records to 'acked' once the proxy confirms receipt.
 *
 * Two backends:
 *  - native: rows in the `mutation_log` SQLite table (created in initDatabase)
 *  - web: a capped ring buffer in localStorage under `lifeos_mutation_log`
 *
 * The web cap (5000 records) keeps localStorage well under quota for a 1-month
 * beta — daily mutation counts in the hundreds per active user. Older entries
 * are dropped from the head of the buffer; the head hash + lamport of the
 * remaining tail are what gets resumed.
 */
import { Platform } from 'react-native';
import type { MutationRecord, MutationSink } from './mutationLog';

export interface ResumeState {
  headHash: string | null;
  lamport: number;
}

/** Outbox/sync states a record can be in (mirrors the `sync_state` column). */
export type SyncState = 'pending' | 'acked' | 'applied_remote';

/** A web ring-buffer entry: a record plus its (optional) outbox state. */
type WebEntry = MutationRecord & { syncState?: SyncState };

export interface LocalSink {
  resume(): Promise<ResumeState>;
  append: MutationSink;
  /** Pending (un-pushed) records, oldest-first, capped at `limit`. */
  readPending(limit: number): Promise<MutationRecord[]>;
  /** Flip the given record ids to 'acked' once the server has them. */
  markSynced(ids: string[]): Promise<void>;
  /**
   * Store a remote (pulled) mutation as 'applied_remote' so it participates in
   * entity fold but is NEVER pushed back (echo prevention). Idempotent by id —
   * returns true only if this id was newly stored (false ⇒ already applied).
   */
  appendApplied(record: MutationRecord): Promise<boolean>;
  /** All mutations (local + applied-remote) for one entity row, for folding. */
  readEntityHistory(entity: string, entityId: string): Promise<MutationRecord[]>;
  /** The last server `seq` this device has pulled (0 if none). */
  getCursor(): Promise<number>;
  /** Persist the pull cursor (server `seq`). */
  setCursor(seq: number): Promise<void>;
  /** Every mutation with its sync state — for compaction planning (T9). */
  readAllWithState(): Promise<{ record: MutationRecord; syncState: SyncState }[]>;
  /** Apply a compaction plan: delete the given ids, insert checkpoints ('acked'). */
  applyCompaction(plan: { checkpoints: MutationRecord[]; deleteIds: string[] }): Promise<void>;
  /** Total rows in the log (for the size gauge). */
  count(): Promise<number>;
}

const WEB_KEY = 'lifeos_mutation_log';
const WEB_CURSOR_KEY = 'lifeos_sync_cursor';
const WEB_CAP = 5000;

let cached: LocalSink | null = null;

/**
 * Process-wide sink. Both the write runtime (appends) and the sync engine
 * (readPending/markSynced) share this instance so they operate on one handle.
 */
export function getLocalSink(): LocalSink {
  if (!cached) cached = Platform.OS === 'web' ? createWebSink() : createNativeSink();
  return cached;
}

/** Test-only: drop the memoized sink so the next call rebuilds it. */
export function _resetLocalSinkForTests(): void {
  cached = null;
}

/** Construct a fresh sink (not memoized). Prefer `getLocalSink()` in app code. */
export function createLocalSink(): LocalSink {
  return Platform.OS === 'web' ? createWebSink() : createNativeSink();
}

// ---------- web ----------

function createWebSink(): LocalSink {
  return {
    async resume(): Promise<ResumeState> {
      const buf = readWebBuffer();
      if (buf.length === 0) return { headHash: null, lamport: 0 };
      // Head hash continues the LOCAL chain only — ignore applied-remote rows.
      let headHash: string | null = null;
      let maxLamport = 0;
      for (const e of buf) {
        if (e.lamport > maxLamport) maxLamport = e.lamport;
        if (e.syncState !== 'applied_remote') headHash = e.hash;
      }
      // Clock resumes at the global max (local + remote) so new local writes
      // never get a lamport ≤ something we've already applied.
      return { headHash, lamport: maxLamport };
    },
    append: async (record: MutationRecord): Promise<void> => {
      const buf = readWebBuffer();
      buf.push({ ...record, syncState: 'pending' });
      if (buf.length > WEB_CAP) buf.splice(0, buf.length - WEB_CAP);
      writeWebBuffer(buf);
    },
    async readPending(limit: number): Promise<MutationRecord[]> {
      const buf = readWebBuffer();
      const pending = buf
        .filter((e) => (e.syncState ?? 'pending') === 'pending')
        .sort((a, b) => a.lamport - b.lamport)
        .slice(0, limit);
      // Strip the web-only `syncState` marker so callers (and the wire payload)
      // see a clean MutationRecord.
      return pending.map(stripSyncState);
    },
    async markSynced(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const buf = readWebBuffer();
      let changed = false;
      for (const e of buf) {
        if (idSet.has(e.id) && e.syncState !== 'acked') {
          e.syncState = 'acked';
          changed = true;
        }
      }
      if (changed) writeWebBuffer(buf);
    },
    async appendApplied(record: MutationRecord): Promise<boolean> {
      const buf = readWebBuffer();
      if (buf.some((e) => e.id === record.id)) return false; // idempotent
      buf.push({ ...record, syncState: 'applied_remote' });
      if (buf.length > WEB_CAP) buf.splice(0, buf.length - WEB_CAP);
      writeWebBuffer(buf);
      return true;
    },
    async readEntityHistory(entity: string, entityId: string): Promise<MutationRecord[]> {
      return readWebBuffer()
        .filter((e) => e.entity === entity && e.entityId === entityId)
        .map(stripSyncState);
    },
    async getCursor(): Promise<number> {
      try {
        const raw = localStorage.getItem(WEB_CURSOR_KEY);
        const n = raw == null ? 0 : Number(raw);
        return Number.isFinite(n) ? n : 0;
      } catch {
        return 0;
      }
    },
    async setCursor(seq: number): Promise<void> {
      try { localStorage.setItem(WEB_CURSOR_KEY, String(seq)); } catch { /* ignore */ }
    },
    async readAllWithState() {
      return readWebBuffer().map((e) => ({
        record: stripSyncState(e),
        syncState: (e.syncState ?? 'pending') as SyncState,
      }));
    },
    async applyCompaction({ checkpoints, deleteIds }) {
      const del = new Set(deleteIds);
      const buf = readWebBuffer().filter((e) => !del.has(e.id));
      for (const c of checkpoints) buf.push({ ...c, syncState: 'acked' });
      if (buf.length > WEB_CAP) buf.splice(0, buf.length - WEB_CAP);
      writeWebBuffer(buf);
    },
    async count() {
      return readWebBuffer().length;
    },
  };
}

/** Drop the web-only outbox marker, yielding a clean MutationRecord. */
function stripSyncState(e: WebEntry): MutationRecord {
  return {
    id: e.id,
    entity: e.entity,
    entityId: e.entityId,
    op: e.op,
    before: e.before,
    after: e.after,
    fields: e.fields,
    ts: e.ts,
    lamport: e.lamport,
    deviceId: e.deviceId,
    userId: e.userId,
    prevHash: e.prevHash,
    hash: e.hash,
  };
}

function readWebBuffer(): WebEntry[] {
  try {
    const raw = localStorage.getItem(WEB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WebEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWebBuffer(buf: WebEntry[]): void {
  try {
    localStorage.setItem(WEB_KEY, JSON.stringify(buf));
  } catch {
    // Quota exceeded — drop oldest 20% and retry once. If still failing,
    // give up silently rather than break the primary write.
    buf.splice(0, Math.floor(buf.length * 0.2));
    try { localStorage.setItem(WEB_KEY, JSON.stringify(buf)); } catch { /* give up */ }
  }
}

// ---------- native ----------

interface RawRow {
  id: string;
  entity: string;
  entity_id: string;
  op: string;
  before_json: string | null;
  after_json: string | null;
  fields_json: string | null;
  ts: string;
  lamport: number;
  device_id: string;
  user_id: string;
  prev_hash: string | null;
  hash: string;
}

function rowToRecord(row: RawRow): MutationRecord {
  const parse = (j: string | null) => {
    if (j === null) return null;
    try { return JSON.parse(j); } catch { return null; }
  };
  let fields: string[] = [];
  try { fields = row.fields_json ? (JSON.parse(row.fields_json) as string[]) : []; } catch { fields = []; }
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    op: row.op as MutationRecord['op'],
    before: parse(row.before_json),
    after: parse(row.after_json),
    fields,
    ts: row.ts,
    lamport: row.lamport,
    deviceId: row.device_id,
    userId: row.user_id,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
}

function createNativeSink(): LocalSink {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  let dbInstance: ReturnType<typeof SQLite.openDatabaseSync> | null = null;
  function getDB() {
    if (dbInstance) return dbInstance;
    dbInstance = SQLite.openDatabaseSync('lifeos.db', { enableChangeListener: true });
    return dbInstance;
  }
  return {
    async resume(): Promise<ResumeState> {
      try {
        const db = getDB();
        // Head hash continues the LOCAL chain only (ignore applied-remote rows).
        const headRow = (await db.getFirstAsync(
          `SELECT hash FROM mutation_log WHERE sync_state != 'applied_remote'
           ORDER BY lamport DESC LIMIT 1`,
        )) as { hash: string } | null;
        // Clock resumes at the global max (local + remote) so new local writes
        // never get a lamport ≤ something we've already applied.
        const maxRow = (await db.getFirstAsync(
          'SELECT MAX(lamport) AS m FROM mutation_log',
        )) as { m: number | null } | null;
        return { headHash: headRow?.hash ?? null, lamport: maxRow?.m ?? 0 };
      } catch {
        // Table missing or query failed — treat as empty log; init will create
        // the table on the next launch.
        return { headHash: null, lamport: 0 };
      }
    },
    append: async (record: MutationRecord): Promise<void> => {
      try {
        await getDB().runAsync(
          `INSERT INTO mutation_log
             (id, entity, entity_id, op, before_json, after_json, fields_json,
              ts, lamport, device_id, user_id, prev_hash, hash)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            record.id,
            record.entity,
            record.entityId,
            record.op,
            record.before === null ? null : JSON.stringify(record.before),
            record.after === null ? null : JSON.stringify(record.after),
            JSON.stringify(record.fields),
            record.ts,
            record.lamport,
            record.deviceId,
            record.userId,
            record.prevHash,
            record.hash,
          ],
        );
      } catch {
        // Sink failures must not break the primary write. The runtime swallows.
      }
    },
    async readPending(limit: number): Promise<MutationRecord[]> {
      try {
        const rows = (await getDB().getAllAsync(
          `SELECT * FROM mutation_log WHERE sync_state = 'pending'
           ORDER BY lamport ASC LIMIT ?`,
          [limit],
        )) as RawRow[];
        return rows.map(rowToRecord);
      } catch {
        return [];
      }
    },
    async markSynced(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      try {
        const placeholders = ids.map(() => '?').join(',');
        await getDB().runAsync(
          `UPDATE mutation_log SET sync_state = 'acked' WHERE id IN (${placeholders})`,
          ids,
        );
      } catch {
        // Non-fatal: an un-acked record stays 'pending' and re-pushes next
        // drain. The server upsert is idempotent, so a double-push is safe.
      }
    },
    async appendApplied(record: MutationRecord): Promise<boolean> {
      try {
        // INSERT OR IGNORE → idempotent by primary key. changes===0 means the
        // mutation was already applied, so the caller can skip re-materializing.
        const res = await getDB().runAsync(
          `INSERT OR IGNORE INTO mutation_log
             (id, entity, entity_id, op, before_json, after_json, fields_json,
              ts, lamport, device_id, user_id, prev_hash, hash, sync_state)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'applied_remote')`,
          [
            record.id,
            record.entity,
            record.entityId,
            record.op,
            record.before === null ? null : JSON.stringify(record.before),
            record.after === null ? null : JSON.stringify(record.after),
            JSON.stringify(record.fields),
            record.ts,
            record.lamport,
            record.deviceId,
            record.userId,
            record.prevHash,
            record.hash,
          ],
        );
        return (res?.changes ?? 0) > 0;
      } catch {
        return false;
      }
    },
    async readEntityHistory(entity: string, entityId: string): Promise<MutationRecord[]> {
      try {
        const rows = (await getDB().getAllAsync(
          'SELECT * FROM mutation_log WHERE entity = ? AND entity_id = ?',
          [entity, entityId],
        )) as RawRow[];
        return rows.map(rowToRecord);
      } catch {
        return [];
      }
    },
    async getCursor(): Promise<number> {
      try {
        const row = (await getDB().getFirstAsync(
          `SELECT last_seq AS s FROM sync_cursor WHERE id = 'remote'`,
        )) as { s: number } | null;
        return row?.s ?? 0;
      } catch {
        return 0;
      }
    },
    async setCursor(seq: number): Promise<void> {
      try {
        await getDB().runAsync(
          `INSERT INTO sync_cursor (id, last_seq) VALUES ('remote', ?)
           ON CONFLICT(id) DO UPDATE SET last_seq = excluded.last_seq`,
          [seq],
        );
      } catch {
        // Non-fatal: a lost cursor just re-pulls (apply is idempotent).
      }
    },
    async readAllWithState() {
      try {
        const rows = (await getDB().getAllAsync('SELECT * FROM mutation_log')) as (RawRow & { sync_state?: string })[];
        return rows.map((r) => ({ record: rowToRecord(r), syncState: (r.sync_state ?? 'pending') as SyncState }));
      } catch {
        return [];
      }
    },
    async applyCompaction({ checkpoints, deleteIds }) {
      try {
        const db = getDB();
        // Delete-then-insert in ONE transaction. Without it, a failure after the
        // deletes but before the checkpoints are written would lose the collapsed
        // rows outright (delete-first). The transaction rolls back atomically,
        // leaving the log exactly as it was.
        await db.withTransactionAsync(async () => {
          for (let i = 0; i < deleteIds.length; i += 400) {
            const chunk = deleteIds.slice(i, i + 400);
            const ph = chunk.map(() => '?').join(',');
            await db.runAsync(`DELETE FROM mutation_log WHERE id IN (${ph})`, chunk);
          }
          for (const c of checkpoints) {
            await db.runAsync(
              `INSERT OR REPLACE INTO mutation_log
                 (id, entity, entity_id, op, before_json, after_json, fields_json,
                  ts, lamport, device_id, user_id, prev_hash, hash, sync_state)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'acked')`,
              [
                c.id, c.entity, c.entityId, c.op,
                c.before === null ? null : JSON.stringify(c.before),
                c.after === null ? null : JSON.stringify(c.after),
                JSON.stringify(c.fields), c.ts, c.lamport, c.deviceId, c.userId, c.prevHash, c.hash,
              ],
            );
          }
        });
      } catch {
        // Best-effort: a failed (rolled-back) compaction leaves the log intact.
      }
    },
    async count() {
      try {
        const row = (await getDB().getFirstAsync('SELECT COUNT(*) AS n FROM mutation_log')) as { n: number } | null;
        return row?.n ?? 0;
      } catch {
        return 0;
      }
    },
  };
}
