/**
 * STARTER_COPY compassion rules + single-file string ownership (AC-8).
 *
 * The cold-start spec (§3.1) makes the copy constraints machine-checked:
 * starter strings invite the first action — they never frame absence as
 * deficit. Rules, all binding:
 *   - no value contains the substrings `yet`, `still`, `only`, `haven't`, `don't`
 *   - no value begins with `No `
 *   - no value contains a standalone `0`
 *   - no value begins with a digit
 *   - every value is ≤ 120 characters
 *
 * Ownership: each STARTER_COPY string literal exists in exactly ONE file in
 * src/ + app/ — starterCopy.ts. Components import; nobody re-types the copy
 * (dilution trap #8). FirstWinCard additionally must contain zero
 * occurrences of withRepeat — "no idle animation, ever" (§3.2).
 */

import * as fs from 'fs';
import * as path from 'path';
import { STARTER_COPY } from '../starterCopy';

const VALUES = Object.entries(STARTER_COPY) as Array<[string, string]>;

const BANNED_SUBSTRINGS = ['yet', 'still', 'only', "haven't", "don't"];

describe('STARTER_COPY — compassion copy rules (§3.1)', () => {
  it('has at least the full cold-start surface set', () => {
    expect(VALUES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(VALUES)('%s: no guilt-framing substrings', (_key, value) => {
    for (const banned of BANNED_SUBSTRINGS) {
      expect({ value, contains: banned, hit: value.toLowerCase().includes(banned) })
        .toEqual({ value, contains: banned, hit: false });
    }
  });

  it.each(VALUES)('%s: never begins with "No "', (_key, value) => {
    expect(value.startsWith('No ')).toBe(false);
  });

  it.each(VALUES)('%s: no standalone 0', (_key, value) => {
    expect(/\b0\b/.test(value)).toBe(false);
  });

  it.each(VALUES)('%s: never begins with a digit', (_key, value) => {
    expect(/^\d/.test(value)).toBe(false);
  });

  it.each(VALUES)('%s: ≤ 120 characters', (_key, value) => {
    expect(value.length).toBeLessThanOrEqual(120);
  });
});

// ── Single-file ownership + no-idle-animation source checks ─────────────────

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('STARTER_COPY — single-file string ownership (trap #8)', () => {
  it('every starter string literal lives in exactly one file: starterCopy.ts', () => {
    const owners = new Map<string, string[]>();
    for (const [key, value] of VALUES) owners.set(key, []);

    for (const dirName of SCAN_DIRS) {
      const dir = path.join(REPO_ROOT, dirName);
      if (!fs.existsSync(dir)) continue;
      for (const file of walk(dir)) {
        const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
        const content = fs.readFileSync(file, 'utf8');
        for (const [key, value] of VALUES) {
          if (content.includes(value)) owners.get(key)!.push(rel);
        }
      }
    }

    for (const [key, files] of owners) {
      expect({ key, files }).toEqual({ key, files: ['src/constants/starterCopy.ts'] });
    }
  });
});

describe('FirstWinCard — no idle animation, ever (§3.2 / AC-8)', () => {
  it('contains zero occurrences of withRepeat', () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, 'src', 'components', 'gamification', 'FirstWinCard.tsx'),
      'utf8',
    );
    expect(source.includes('withRepeat')).toBe(false);
  });
});
