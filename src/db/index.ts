import { Platform } from 'react-native';
import * as schema from './schema';

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

    CREATE TABLE IF NOT EXISTS health_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      weight REAL,
      height_cm REAL,
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

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT,
      relationship_type TEXT NOT NULL,
      preferred_cadence_days INTEGER NOT NULL,
      last_contact_date TEXT,
      notes TEXT,
      birthday TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contact_interactions (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT,
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

    CREATE TABLE IF NOT EXISTS learning_resources (
      id TEXT PRIMARY KEY,
      career_profile_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      estimated_hours REAL,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      completed_at TEXT,
      weekly_minutes INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skill_gaps (
      id TEXT PRIMARY KEY,
      career_profile_id TEXT NOT NULL,
      skill TEXT NOT NULL,
      current_level TEXT NOT NULL,
      required_level TEXT NOT NULL,
      priority INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS career_profiles (
      id TEXT PRIMARY KEY,
      current_role TEXT NOT NULL,
      target_role TEXT NOT NULL,
      timeline_months INTEGER NOT NULL,
      current_skills TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      target_count INTEGER NOT NULL DEFAULT 1,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_completed_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  await safeAlter(`ALTER TABLE goals ADD COLUMN priority INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE health_logs ADD COLUMN height_cm REAL`);
}
