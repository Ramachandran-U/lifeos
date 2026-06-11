/**
 * Motion token COMPLIANCE guard (Aurora Alive M0).
 *
 * Every animation duration in the app must come from the motion vocabulary in
 * src/theme/motion.ts (MOTION_BUDGET / TIMING / INTERACTION / AMBIENT) — raw
 * millisecond literals drift the timing language apart (the M0 sweep migrated
 * 68 of them). This test greps the source tree for new raw literals in
 *   withTiming(..., { duration: <number> })   and   .duration(<number>)
 * and fails unless the file is on the ALLOWLIST below.
 *
 * The allowlist is a ONE-WAY RATCHET (same culture as the jest coverage
 * floors): it enumerates the not-yet-migrated files at the time M0 landed —
 * mostly app/** screens. PRs may REMOVE entries as files are migrated, never
 * add new ones without explicit justification in review.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Files allowed to carry raw duration literals, as repo-relative POSIX paths.
const ALLOWLIST = new Set<string>([
  // Token definitions themselves.
  'src/theme/motion.ts',
  // app/** screens awaiting the W2+ ratchet pass (auth + onboarding + tabs).
  'app/(auth)/sign-in.tsx',
  'app/(auth)/sign-up.tsx',
  'app/(auth)/welcome.tsx',
  'app/(onboarding)/day14-polymath.tsx',
  'app/(onboarding)/day1-career.tsx',
  'app/(onboarding)/day1-routine.tsx',
  'app/(onboarding)/day1-vision.tsx',
  'app/(onboarding)/day3-health.tsx',
  'app/(onboarding)/day7-finance.tsx',
  'app/(onboarding)/day7-social.tsx',
  'app/(onboarding)/discovery-chat.tsx',
  'app/(onboarding)/discovery-confirm.tsx',
  'app/(onboarding)/discovery-intro.tsx',
  'app/(onboarding)/discovery-paste.tsx',
  'app/(tabs)/goals.tsx',
  'app/(tabs)/index.tsx',
  // W4 foundation (2026-06-12): entries follow the legacy extraction
  // (app/(tabs)/{career,explore,finance,health,social}.tsx ->
  // src/screens/legacy/*.legacy.tsx); not growth - the route files are now
  // clean wrappers and their five entries here were renamed 1:1.
  'src/screens/legacy/CareerScreen.legacy.tsx',
  'src/screens/legacy/ExploreScreen.legacy.tsx',
  'src/screens/legacy/FinanceScreen.legacy.tsx',
  'src/screens/legacy/HealthScreen.legacy.tsx',
  'src/screens/legacy/SocialScreen.legacy.tsx',
  'app/activity.tsx',
  'app/annual-review.tsx',
  'app/contact/[id].tsx',
  'app/data-residency.tsx',
  'app/evening-reflect.tsx',
  'app/expedition-detail.tsx',
  'app/feedback.tsx',
  'app/finance-category.tsx',
  'app/finance-merchant.tsx',
  'app/finance-review.tsx',
  'app/monthly-insight.tsx',
  'app/welcome-intent.tsx',
]);

// `duration: 0` is an intentional instant (reduce-motion paths) — allowed.
const RAW_DURATION_PROP = /duration:\s*(?!0[^.\d])\d/;
const RAW_DURATION_BUILDER = /\.duration\(\s*\d/;

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
        if (RAW_DURATION_PROP.test(line) || RAW_DURATION_BUILDER.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  }
  return violations;
}

describe('motion token compliance — no raw duration literals outside the allowlist', () => {
  it('src/** and app/** use motion tokens for every animation duration', () => {
    const violations = findViolations();
    if (violations.length > 0) {
      throw new Error(
        'Raw animation-duration literals found. Use MOTION_BUDGET / TIMING / ' +
        'INTERACTION / AMBIENT from @/theme/motion (snap within ±20%, or add a ' +
        'semantic token). Violations:\n  ' + violations.join('\n  '),
      );
    }
  });

  it('the allowlist only shrinks (entries must exist on disk)', () => {
    // A deleted/renamed file left on the allowlist silently widens the gate
    // for a future file with the same name — prune it instead.
    for (const rel of ALLOWLIST) {
      const full = path.join(REPO_ROOT, ...rel.split('/'));
      expect({ rel, exists: fs.existsSync(full) }).toEqual({ rel, exists: true });
    }
  });
});
