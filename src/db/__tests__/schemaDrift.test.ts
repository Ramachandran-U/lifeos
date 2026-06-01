/**
 * Schema-drift guard (P1-T10).
 *
 * Every table + column the Drizzle schema declares MUST actually be created in
 * initDatabase() — via CREATE TABLE or a safeAlter ADD COLUMN — or native SQLite
 * is missing what the ORM writes to, and those writes throw "no such column" at
 * runtime (a class of bug that's invisible on web, which uses localStorage).
 *
 * Tables that initDatabase explicitly DROPs are exempt: an intentional removal
 * that may still linger as a Drizzle export. (Keeps the guard self-maintaining —
 * no hand-kept allowlist.)
 *
 * We parse the SQL out of src/db/index.ts as text because initDatabase() can't
 * run here (it needs expo-sqlite).
 *
 * The comparison itself lives in `findColumnDrift` (exported) so the sentinel
 * tests below can prove the guard actually FIRES on drift — a guard that always
 * passes is worthless, and a positive-only suite can't tell the two apart.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '../schema';

function parseInitDatabase(): { created: Record<string, Set<string>>; dropped: Set<string> } {
  const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8');
  const created: Record<string, Set<string>> = {};
  const dropped = new Set<string>();
  let m: RegExpExecArray | null;

  const createRe = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\n\s*\);/g;
  while ((m = createRe.exec(src))) {
    const cols = new Set<string>();
    for (const raw of m[2].split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('--')) continue;
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line)) continue;
      const col = line.match(/^"?(\w+)"?/);
      if (col) cols.add(col[1]);
    }
    created[m[1]] = cols;
  }

  const alterRe = /ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/gi;
  while ((m = alterRe.exec(src))) {
    (created[m[1]] ??= new Set<string>()).add(m[2]);
  }

  const dropRe = /DROP TABLE IF EXISTS\s+(\w+)/gi;
  while ((m = dropRe.exec(src))) dropped.add(m[1]);

  return { created, dropped };
}

/**
 * The guard's core check, extracted so the sentinel tests can verify it fires.
 * Returns which declared columns initDatabase never creates (empty ⇒ no drift)
 * and whether the table itself is missing. A DROP'd table is exempt (intentional
 * removal that may still linger as a Drizzle export).
 */
export function findColumnDrift(
  created: Record<string, Set<string>>,
  dropped: Set<string>,
  tableName: string,
  declaredColumns: string[],
): { tableMissing: boolean; missingColumns: string[] } {
  if (dropped.has(tableName)) return { tableMissing: false, missingColumns: [] };
  const cols = created[tableName];
  if (!cols) return { tableMissing: true, missingColumns: declaredColumns };
  return { tableMissing: false, missingColumns: declaredColumns.filter((c) => !cols.has(c)) };
}

const { created, dropped } = parseInitDatabase();
// `is(v, SQLiteTable)` narrows to SQLiteTable<TableConfig>, which isn't
// assignable back to the specific per-table union schema exports carry, so a
// `v is SQLiteTable` predicate trips TS2677. Plain boolean filter + cast instead.
const tables = (Object.values(schema).filter((v) => is(v, SQLiteTable)) as SQLiteTable[])
  .map((t) => getTableConfig(t));

describe('schema drift: schema.ts ⊆ initDatabase()', () => {
  test('sanity: introspected the Drizzle schema and parsed CREATE statements', () => {
    expect(tables.length).toBeGreaterThan(5);
    expect(Object.keys(created).length).toBeGreaterThan(5);
  });

  for (const cfg of tables) {
    const tableName = cfg.name;
    test(`"${tableName}" created with all declared columns (or dropped on purpose)`, () => {
      const drift = findColumnDrift(created, dropped, tableName, cfg.columns.map((c) => c.name));
      expect(drift.tableMissing).toBe(false);
      expect(drift.missingColumns).toEqual([]);
    });
  }
});

// Sentinel / negative tests — prove the guard FAILS on real drift, so a green
// positive suite above actually means something. They run findColumnDrift (the
// same logic the per-table loop uses) against deliberately-drifted inputs.
describe('schema drift: the guard catches drift (sentinel tests)', () => {
  test('flags a declared column that initDatabase never creates', () => {
    // The exact mistake the guard exists to catch: schema.ts grows a column on a
    // real table but nobody adds the matching CREATE/ALTER DDL.
    const realTable = Object.keys(created).find((t) => !dropped.has(t));
    expect(realTable).toBeDefined();
    const declared = [...created[realTable!], '__sentinel_undeclared_col__'];
    const drift = findColumnDrift(created, dropped, realTable!, declared);
    expect(drift.tableMissing).toBe(false);
    expect(drift.missingColumns).toEqual(['__sentinel_undeclared_col__']);
  });

  test('flags a table that schema.ts declares but initDatabase never creates', () => {
    const drift = findColumnDrift(created, dropped, '__no_such_table__', ['id', 'foo']);
    expect(drift.tableMissing).toBe(true);
    expect(drift.missingColumns).toEqual(['id', 'foo']);
  });

  test('exempts a table that initDatabase explicitly DROPs', () => {
    const drift = findColumnDrift({}, new Set(['ghost_table']), 'ghost_table', ['id', 'gone']);
    expect(drift.tableMissing).toBe(false);
    expect(drift.missingColumns).toEqual([]);
  });

  test('passes cleanly when every declared column exists', () => {
    const drift = findColumnDrift({ foo: new Set(['id', 'bar']) }, new Set(), 'foo', ['id', 'bar']);
    expect(drift.tableMissing).toBe(false);
    expect(drift.missingColumns).toEqual([]);
  });
});
