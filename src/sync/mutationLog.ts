/**
 * The mutation log — the event-sourced spine of LifeOS.
 *
 * Every converted write emits one append-only MutationRecord. Sync, version
 * history, the cognitive signal stream, and the memory graph are all derived
 * from this single log (see roadmap/00-architecture-audit.md §3).
 *
 * This module is the PURE core: it builds correctly-ordered, hash-chained
 * records. Persistence (SQLite append) and transport (Supabase) are separate
 * sinks wired in later increments — kept out of here so the core is unit
 * testable under pure Node and reusable on web + native.
 */
import { LamportClock } from './lamport';
import { chainHash, type Hasher } from './hashChain';

export type MutationOp = 'insert' | 'update' | 'delete';

/** A row snapshot — entity payloads are flat JSON-serializable records. */
export type EntitySnapshot = Record<string, unknown> | null;

export interface MutationInput {
  entity: string;
  entityId: string;
  op: MutationOp;
  /** State before the write (null for insert). */
  before: EntitySnapshot;
  /** State after the write (null for delete). */
  after: EntitySnapshot;
}

export interface MutationRecord {
  id: string;
  entity: string;
  entityId: string;
  op: MutationOp;
  before: EntitySnapshot;
  after: EntitySnapshot;
  /** Columns that changed (update only) — drives field-level conflict merge. */
  fields: string[];
  /** ISO wall clock — display/debug only, NEVER used for ordering. */
  ts: string;
  /** Authoritative logical ordering. */
  lamport: number;
  deviceId: string;
  userId: string;
  prevHash: string | null;
  hash: string;
}

/** A sink persists/forwards appended records (SQLite, Supabase outbox, …). */
export type MutationSink = (record: MutationRecord) => void | Promise<void>;

export interface MutationLogOptions {
  hasher: Hasher;
  deviceId: string;
  userId: string;
  /** Resume an existing chain: prior head hash + last lamport seen. */
  headHash?: string | null;
  initialLamport?: number;
  clock?: LamportClock;
  now?: () => Date;
  newId?: () => string;
  sink?: MutationSink;
}

/**
 * Compute changed top-level fields between two snapshots. Uses JSON equality so
 * nested objects/arrays compare by value. Insert => all keys of `after`;
 * delete => []; update => keys whose value changed (incl. added/removed).
 */
export function diffFields(before: EntitySnapshot, after: EntitySnapshot): string[] {
  if (!before && after) return Object.keys(after);
  if (before && !after) return [];
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed.sort();
}

let idCounter = 0;
function defaultId(): string {
  idCounter += 1;
  return `m_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class MutationLog {
  private readonly clock: LamportClock;
  private readonly hasher: Hasher;
  private readonly deviceId: string;
  private readonly userId: string;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly sink?: MutationSink;
  private headHash: string | null;

  constructor(opts: MutationLogOptions) {
    this.hasher = opts.hasher;
    this.deviceId = opts.deviceId;
    this.userId = opts.userId;
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? defaultId;
    this.sink = opts.sink;
    this.headHash = opts.headHash ?? null;
    this.clock = opts.clock ?? new LamportClock(opts.initialLamport ?? 0);
  }

  /** Current chain head hash (null before the first append). */
  get head(): string | null {
    return this.headHash;
  }

  /** Current logical time. */
  get lamport(): number {
    return this.clock.current;
  }

  /**
   * Append a local mutation. Advances the Lamport clock, computes the chained
   * hash, forwards to the sink, and updates the head. Returns the record.
   */
  async record(input: MutationInput): Promise<MutationRecord> {
    if (input.op === 'insert' && !input.after) {
      throw new Error('insert mutation requires an `after` snapshot');
    }
    if (input.op === 'delete' && !input.before) {
      throw new Error('delete mutation requires a `before` snapshot');
    }

    const lamport = this.clock.tick();
    const fields = input.op === 'update' ? diffFields(input.before, input.after) : [];

    // The hashed payload deliberately excludes id/hash/prevHash (the envelope)
    // so the hash commits to the *content + position*, not to a random id.
    const payload = {
      entity: input.entity,
      entityId: input.entityId,
      op: input.op,
      before: input.before,
      after: input.after,
      fields,
      lamport,
      deviceId: this.deviceId,
      userId: this.userId,
    };
    const hash = await chainHash(this.headHash, payload, this.hasher);

    const rec: MutationRecord = {
      id: this.newId(),
      ts: this.now().toISOString(),
      prevHash: this.headHash,
      hash,
      ...payload,
    };

    this.headHash = hash;
    if (this.sink) await this.sink(rec);
    return rec;
  }

  /**
   * Fold in a logical time observed from a remote mutation so the next local
   * append is ordered after it. (Applying remote records into local state is
   * the reducer's job — a later increment.)
   */
  observeRemote(lamport: number): void {
    this.clock.observe(lamport);
  }
}
