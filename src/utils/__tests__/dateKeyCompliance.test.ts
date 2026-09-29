/**
 * Guard — local calendar keys are never derived from UTC.
 *
 * A YYYY-MM-DD string in this app means the USER'S local calendar day: routine
 * blocks, reflections, transactions, XP history and streaks are all keyed that
 * way (see `src/utils/dateKeys.ts`). Deriving one via
 * `new Date().toISOString().slice(0, 10)` formats in UTC, so for any user whose
 * offset is behind/ahead of UTC the key lands on the wrong day near the
 * boundary — in IST (UTC+5:30) every moment between 00:00 and 05:30 local
 * yields YESTERDAY.
 *
 * This is not hypothetical. Before this guard landed:
 *   - `app/(tabs)/finance.tsx` computed the month-start filter in UTC, so
 *     September's savings rate included 31 August — while
 *     `src/finance/analytics.ts` computed the same boundary CORRECTLY with
 *     `localYmd`, so the two disagreed.
 *   - `getReflectionStreak()` walked the streak with UTC keys while
 *     `app/evening-reflect.tsx` WROTE reflections with local keys, so a
 *     reflection logged after midnight IST did not count toward the streak.
 *
 * Use `localYmd(d)` / `todayKey()` from `src/utils/dateKeys.ts` instead.
 *
 * ONE-WAY RATCHET: the allowlist shrinks as sites migrate, and an entry is only
 * added for a site doing genuine UTC-anchored day ARITHMETIC (input anchored at
 * `T00:00:00Z`), never for a local calendar key. False positive → allowlist that
 * one file with a comment, never weaken the regex.
 *
 * Seed: 20 occurrences across 16 files. Measured 2026-09-29 (landing day).
 * Reproduce: empty the ALLOWLIST below and run
 *   npx jest src/utils/__tests__/dateKeyCompliance.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app'];
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules', '.claude']);

/** `toISOString().slice(0,10)` and the `split('T')[0]` / `substring(0,10)` variants. */
const UTC_DATE_KEY =
  /toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*10\s*\)|substring\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\])/;

// `src/ai/outcomes/measure.ts` anchors its input at UTC midnight
// (`Date.parse(`${date}T00:00:00Z`)`) before adding whole days, so formatting
// back through toISOString() is timezone-INVARIANT day math on a date string,
// not a local calendar key. Switching it to localYmd would re-introduce an
// offset shift into the arithmetic. See the comment at the call site.
const ALLOWLIST = new Set<string>(['src/ai/outcomes/measure.ts']);

/** Comment lines are prose about the pattern, not uses of it. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

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

function findViolations(): string[] {
  const violations: string[] = [];
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(REPO_ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (ALLOWLIST.has(rel)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!isComment(line) && UTC_DATE_KEY.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe('date-key compliance — local calendar keys are never derived from UTC', () => {
  it('no source file derives a YYYY-MM-DD key via toISOString()', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'UTC-derived local date key found. A YYYY-MM-DD key means the USER\'S ' +
          'local day — use localYmd(d) / todayKey() from src/utils/dateKeys.ts. ' +
          'In IST this bug files everything between 00:00 and 05:30 under ' +
          'yesterday. Violations:\n  ' +
          violations.join('\n  '),
      );
    }
  });

  it('the allowlist only shrinks (entries must exist on disk)', () => {
    for (const rel of ALLOWLIST) {
      const full = path.join(REPO_ROOT, ...rel.split('/'));
      expect({ rel, exists: fs.existsSync(full) }).toEqual({ rel, exists: true });
    }
  });
});
