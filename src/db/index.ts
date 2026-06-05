import { Platform } from 'react-native';
import { subDays, format } from 'date-fns';
import * as schema from './schema';
import { BEHAVIOUR_RETENTION_DAYS } from './retention';

type DB = ReturnType<typeof import('drizzle-orm/expo-sqlite').drizzle>;

let _db: DB | null = null;

export function getDB(): DB {
  if (_db) return _db;
  if (Platform.OS === 'web') {
    throw new Error('SQLite is not available on web');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const { drizzle } = require('drizzle-orm/expo-sqlite') as typeof import('drizzle-orm/expo-sqlite');
  const expo = SQLite.openDatabaseSync('lifeos.db', { enableChangeListener: true });
  _db = drizzle(expo, { schema });
  return _db;
}

// Chainable no-op for web — every property access and function call returns the same proxy
// Terminal methods like .all() return [], .get() returns undefined, .run() returns undefined
// eslint-disable-next-line @typescript-eslint/no-empty-function
const WEB_NOOP: unknown = new Proxy(function(){} as object, {
  get(_target, prop) {
    if (prop === 'all') return () => [];
    if (prop === 'get') return () => undefined;
    if (prop === 'run') return () => undefined;
    if (prop === 'values') return () => WEB_NOOP;
    return WEB_NOOP;
  },
  apply() { return WEB_NOOP; },
});

// Keep backward compat — but only access on native
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    if (Platform.OS === 'web') return WEB_NOOP;
    return (getDB() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

let _expo: ReturnType<typeof import('expo-sqlite').openDatabaseSync> | null = null;

function getExpo() {
  if (_expo) return _expo;
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  _expo = SQLite.openDatabaseSync('lifeos.db', { enableChangeListener: true });
  return _expo;
}

export async function initDatabase() {
  if (Platform.OS === 'web') {
    console.log('SQLite not available on web, skipping DB init');
    return;
  }

  const expo = getExpo();
  await expo.execAsync(`PRAGMA journal_mode = WAL;`);
  await expo.execAsync(`PRAGMA foreign_keys = ON;`);

  await expo.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      height_cm REAL,
      vision_statement TEXT,
      wake_time TEXT,
      sleep_time TEXT,
      work_start_time TEXT,
      work_end_time TEXT,
      onboarding_stage INTEGER NOT NULL DEFAULT 0,
      install_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      goal_type TEXT NOT NULL,
      parent_id TEXT,
      level TEXT NOT NULL,
      timeline TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      energy_level TEXT,
      ai_generated INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS goals_user_parent_idx ON goals (user_id, parent_id);

    CREATE TABLE IF NOT EXISTS goal_comments (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routine_blocks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      module TEXT NOT NULL,
      linked_entity_id TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      calendar_event_id TEXT,
      energy_required TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS routine_blocks_date_idx ON routine_blocks (date);
    CREATE INDEX IF NOT EXISTS routine_blocks_date_status_idx ON routine_blocks (date, status);

    CREATE TABLE IF NOT EXISTS health_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      weight REAL,
      sleep_hours REAL,
      steps INTEGER,
      energy_level INTEGER,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_name TEXT NOT NULL,
      quantity_g REAL NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fibre REAL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blood_reports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      report_name TEXT NOT NULL,
      parsed_markers TEXT,
      ai_summary TEXT,
      ai_suggestions TEXT,
      raw_file_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      weekly_minutes_target INTEGER NOT NULL,
      weekly_minutes_actual INTEGER NOT NULL DEFAULT 0,
      enjoyment_level INTEGER,
      exploration_depth TEXT NOT NULL DEFAULT 'taste',
      status TEXT NOT NULL DEFAULT 'active',
      discovered_by TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exploration_log (
      id TEXT PRIMARY KEY,
      interest_id TEXT NOT NULL,
      date TEXT NOT NULL,
      minutes_spent INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS financial_goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target_amount REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      target_date TEXT,
      income_bracket TEXT,
      monthly_savings REAL,
      risk_profile TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finance_milestones (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_date TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gamification (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain_scores TEXT NOT NULL DEFAULT '{}',
      streaks TEXT NOT NULL DEFAULT '{}',
      badges TEXT NOT NULL DEFAULT '[]',
      total_xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS behaviour_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      module TEXT NOT NULL,
      metadata TEXT,
      hour INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS behaviour_events_created_at_idx ON behaviour_events (created_at);
    CREATE INDEX IF NOT EXISTS behaviour_events_event_type_created_at_idx ON behaviour_events (event_type, created_at);

    CREATE TABLE IF NOT EXISTS cognitive_insights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      domain TEXT NOT NULL,
      evidence TEXT NOT NULL,
      suggestions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'proposed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS cognitive_insights_lookup_idx ON cognitive_insights (user_id, kind, domain, created_at);

    CREATE TABLE IF NOT EXISTS expeditions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      theme TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT 'polymath',
      steps TEXT NOT NULL DEFAULT '[]',
      total_steps INTEGER NOT NULL,
      source TEXT NOT NULL,
      seed_spark_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS expeditions_user_idx ON expeditions (user_id);

    CREATE TABLE IF NOT EXISTS expedition_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expedition_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      current_step INTEGER NOT NULL DEFAULT 0,
      completed_steps TEXT NOT NULL DEFAULT '[]',
      started_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL,
      completed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS expedition_progress_unique_idx ON expedition_progress (user_id, expedition_id);

    CREATE TABLE IF NOT EXISTS sparks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      thread_starter TEXT NOT NULL,
      seed_interest TEXT NOT NULL DEFAULT '',
      adjacent_field TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      thread_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS sparks_user_date_idx ON sparks (user_id, date);

    CREATE TABLE IF NOT EXISTS daily_reflections (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      mood INTEGER,
      block_reviews TEXT NOT NULL,
      tweak_accepted INTEGER,
      tweak_payload TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discovery_imports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      extracted TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id, created_at);

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      profile TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence_overall REAL NOT NULL DEFAULT 0,
      routine_unlocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Append-only event-sourced spine. See src/sync/mutationLog.ts. Writes
    -- to other tables emit one row here; sync (later) reads from this table.
    CREATE TABLE IF NOT EXISTS mutation_log (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      op TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      fields_json TEXT NOT NULL DEFAULT '[]',
      ts TEXT NOT NULL,
      lamport INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      prev_hash TEXT,
      hash TEXT NOT NULL,
      -- Outbox state for the sync engine (P1-T5): 'pending' until pushed to
      -- Supabase, then 'acked'. Locally-applied remote mutations are written
      -- 'applied_remote' so they're never pushed back (echo prevention).
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS mutation_log_lamport_idx ON mutation_log (lamport);
    CREATE INDEX IF NOT EXISTS mutation_log_entity_idx ON mutation_log (entity, entity_id);
    CREATE INDEX IF NOT EXISTS mutation_log_sync_state_idx ON mutation_log (sync_state, lamport);

    -- Pull cursor for the sync engine (P1-T5/T6): the last server seq this
    -- device has pulled. Single row keyed 'remote'. Server seq is a gap-free
    -- monotonic sequence, so seq-greater-than-cursor never misses or duplicates.
    CREATE TABLE IF NOT EXISTS sync_cursor (
      id       TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS memory_facts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT,
      salience REAL NOT NULL DEFAULT 1,
      source_window TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS memory_facts_user_idx ON memory_facts (user_id, last_seen_at);

    CREATE TABLE IF NOT EXISTS memory_suppressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS memory_suppressions_user_idx ON memory_suppressions (user_id);

    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      task TEXT NOT NULL,
      variant TEXT NOT NULL,
      model TEXT,
      input_hash TEXT NOT NULL,
      output_summary TEXT,
      output_ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggestion_outcomes (
      id TEXT PRIMARY KEY,
      suggestion_id TEXT NOT NULL,
      window_days INTEGER NOT NULL,
      blocks_total INTEGER,
      blocks_completed INTEGER,
      completion_rate REAL,
      domain_score_delta REAL,
      measured_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Rabbit-hole decision-tree map (Explore v3). The whole tree is a JSON blob
    -- in tree_json. LOCAL ONLY — sync parked to Phase 7. See
    -- docs/rabbit-hole-tree-map-redesign.md.
    CREATE TABLE IF NOT EXISTS rabbit_hole_trees (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      spark_id TEXT NOT NULL,
      anchor_json TEXT NOT NULL,
      tree_json TEXT NOT NULL,
      scoring_json TEXT NOT NULL,
      title TEXT,
      xp_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS rabbit_hole_trees_user_idx ON rabbit_hole_trees (user_id, created_at);
    CREATE INDEX IF NOT EXISTS rabbit_hole_trees_spark_idx ON rabbit_hole_trees (spark_id);

    -- Local, rebuildable constellation edge source emitted by rabbit-hole
    -- journeys (led_to / synapse). Read by projectConstellation as an extra
    -- edge source; bypasses the sync mutation log.
    CREATE TABLE IF NOT EXISTS constellation_edges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      source_tree_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS constellation_edges_user_idx ON constellation_edges (user_id);
  `);

  // Lightweight migrations for columns added after initial release.
  // SQLite throws on duplicate ADD COLUMN — swallow that specific error.
  const safeAlter = async (sqlStmt: string) => {
    try {
      await expo.execAsync(sqlStmt);
    } catch (err) {
      const msg = String(err);
      if (!/duplicate column name/i.test(msg)) throw err;
    }
  };
  await safeAlter(`ALTER TABLE interests ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
  await safeAlter(`ALTER TABLE users ADD COLUMN height_cm REAL`);
  await safeAlter(`ALTER TABLE users ADD COLUMN avatar_uri TEXT`);
  await safeAlter(`ALTER TABLE users ADD COLUMN avatar_source_uri TEXT`);
  await safeAlter(`ALTER TABLE goals ADD COLUMN priority INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE users ADD COLUMN sex TEXT`);
  await safeAlter(`ALTER TABLE users ADD COLUMN activity_level TEXT`);
  await safeAlter(`ALTER TABLE health_logs ADD COLUMN water_ml REAL`);
  await safeAlter(`ALTER TABLE health_logs ADD COLUMN recovery_score REAL`);
  // Sync outbox state for installs created before P1-T5. Existing rows backfill
  // to 'pending' so the first sync drains the accumulated beta history.
  await safeAlter(`ALTER TABLE mutation_log ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'pending'`);
  await expo.execAsync(
    `CREATE INDEX IF NOT EXISTS mutation_log_sync_state_idx ON mutation_log (sync_state, lamport);`,
  );
  // Schema-drift reconciliation (P1-T10): columns declared in schema.ts but
  // never created here, so native writes to them threw "no such column".
  await safeAlter(`ALTER TABLE users ADD COLUMN sleep_target_hours INTEGER`);
  await safeAlter(`ALTER TABLE users ADD COLUMN health_goal_type TEXT`);
  await safeAlter(`ALTER TABLE users ADD COLUMN primary_domains TEXT`);
  await safeAlter(`ALTER TABLE users ADD COLUMN activated_modules TEXT`);
  await safeAlter(`ALTER TABLE interests ADD COLUMN time_protected INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE memory_facts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);

  // Retention: behaviour_events is append-only analytics read only over the
  // last ≤30 days, so prune anything older at boot to bound on-device growth.
  // (The web sink caps by count + age in webInsertBehaviourEvent; native had no
  // bound at all.) The cutoff is an app-computed date string, not user input.
  // Best-effort — a failure here must never block DB init.
  try {
    const behaviourCutoff = format(subDays(new Date(), BEHAVIOUR_RETENTION_DAYS), 'yyyy-MM-dd');
    await expo.runAsync(`DELETE FROM behaviour_events WHERE created_at < ?`, behaviourCutoff);
  } catch {
    /* non-fatal: pruning is housekeeping, not correctness */
  }

  // Drop zombie tables — never had queries, no UI, no roadmap commitment
  // (architect-review §P1-5). Idempotent: DROP IF EXISTS is a no-op when the
  // table is already gone on fresh installs.
  await expo.execAsync(`
    DROP TABLE IF EXISTS contacts;
    DROP TABLE IF EXISTS contact_interactions;
    DROP TABLE IF EXISTS habits;
    DROP TABLE IF EXISTS learning_resources;
    DROP TABLE IF EXISTS skill_gaps;
    DROP TABLE IF EXISTS career_profiles;
  `);
}
