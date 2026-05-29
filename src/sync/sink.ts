/**
 * Local sink for the mutation log. Persists records and exposes a `resume`
 * step that loads the chain head + last lamport so the in-memory MutationLog
 * picks up where the previous session left off.
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

export interface LocalSink {
  resume(): Promise<ResumeState>;
  append: MutationSink;
}

const WEB_KEY = 'lifeos_mutation_log';
const WEB_CAP = 5000;

export function createLocalSink(): LocalSink {
  return Platform.OS === 'web' ? createWebSink() : createNativeSink();
}

// ---------- web ----------

function createWebSink(): LocalSink {
  return {
    async resume(): Promise<ResumeState> {
      const buf = readWebBuffer();
      if (buf.length === 0) return { headHash: null, lamport: 0 };
      const tail = buf[buf.length - 1];
      return { headHash: tail.hash, lamport: tail.lamport };
    },
    append: async (record: MutationRecord): Promise<void> => {
      const buf = readWebBuffer();
      buf.push(record);
      if (buf.length > WEB_CAP) buf.splice(0, buf.length - WEB_CAP);
      try {
        localStorage.setItem(WEB_KEY, JSON.stringify(buf));
      } catch {
        // Quota exceeded — drop oldest 20% and retry once. If still failing,
        // give up silently rather than break the primary write.
        buf.splice(0, Math.floor(buf.length * 0.2));
        try { localStorage.setItem(WEB_KEY, JSON.stringify(buf)); } catch { /* give up */ }
      }
    },
  };
}

function readWebBuffer(): MutationRecord[] {
  try {
    const raw = localStorage.getItem(WEB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MutationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------- native ----------

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
        const row = (await getDB().getFirstAsync(
          'SELECT hash, lamport FROM mutation_log ORDER BY lamport DESC LIMIT 1',
        )) as { hash: string; lamport: number } | null;
        if (!row) return { headHash: null, lamport: 0 };
        return { headHash: row.hash, lamport: row.lamport };
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
  };
}
