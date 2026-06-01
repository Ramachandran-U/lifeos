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

const { created, dropped } = parseInitDatabase();
const tables = Object.values(schema)
  .filter((v): v is SQLiteTable => is(v, SQLiteTable))
  .map((t) => getTableConfig(t));

describe('schema drift: schema.ts ⊆ initDatabase()', () => {
  test('sanity: introspected the Drizzle schema and parsed CREATE statements', () => {
    expect(tables.length).toBeGreaterThan(5);
    expect(Object.keys(created).length).toBeGreaterThan(5);
  });

  for (const cfg of tables) {
    const tableName = cfg.name;
    test(`"${tableName}" created with all declared columns (or dropped on purpose)`, () => {
      if (dropped.has(tableName)) return;
      expect(created[tableName]).toBeDefined();
      const missing = cfg.columns.map((c) => c.name).filter((name) => !created[tableName].has(name));
      expect(missing).toEqual([]);
    });
  }
});
