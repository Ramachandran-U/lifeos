/**
 * Guard — every test file on disk is actually RUN by one of the jest projects.
 *
 * `jest.config.js` defines two projects with disjoint responsibilities:
 *   • node       — `*.test.ts`, but ignores /src/components/ and /src/hooks/
 *   • components — `*.test.tsx`, but ONLY under src/components, src/hooks, src/screens
 *
 * Between them sits a silent gap. A `*.test.ts` under src/hooks/ matches the node
 * project's testMatch but is excluded by its testPathIgnorePatterns, and does not
 * match the components project's testMatch at all — so it runs NOWHERE. It still
 * looks like a passing, committed test suite in the repo and in review.
 *
 * Three files sat in that gap (30 cases: addToHomeScreen, useNotifications,
 * useSpeechRecognition). One of them could never have passed — it was written
 * against ts-jest semantics and threw a babel out-of-scope error the moment it was
 * actually executed. That is the real cost: not 30 missing tests, but 30 tests
 * everyone believed were green.
 *
 * The same gap would swallow a `*.test.ts` under src/components/, or a `*.test.tsx`
 * anywhere outside those three directories (e.g. under app/ or src/finance/).
 *
 * This guard reads the REAL config rather than restating the rules, so it cannot
 * drift from jest.config.js.
 */

import * as fs from 'fs';
import * as path from 'path';
// micromatch ships no type declarations and @types/micromatch is not a dep here.
// Require it behind an explicit contract: no `any`, no new dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const micromatch = require('micromatch') as {
  isMatch(target: string, patterns: string[]): boolean;
};

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app', 'workers'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.claude', 'dist', 'coverage']);

interface ProjectConfig {
  displayName: string;
  testMatch: string[];
  testPathIgnorePatterns?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jestConfig = require(path.join(REPO_ROOT, 'jest.config.js')) as {
  projects: ProjectConfig[];
};

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(entry.name)) yield* walk(full);
    } else if (/\.(test|spec)\.tsx?$/.test(entry.name)) {
      yield full;
    }
  }
}

/** Mirrors how jest evaluates one project against a path. */
function projectRuns(project: ProjectConfig, relPosix: string): boolean {
  const absLike = `/${relPosix}`;
  for (const pattern of project.testPathIgnorePatterns ?? []) {
    if (new RegExp(pattern).test(absLike)) return false;
  }
  return micromatch.isMatch(relPosix, project.testMatch);
}

function findOrphans(): string[] {
  const orphans: string[] = [];
  for (const dirName of SCAN_DIRS) {
    const dir = path.join(REPO_ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (!jestConfig.projects.some((p) => projectRuns(p, rel))) orphans.push(rel);
    }
  }
  return orphans;
}

describe('test-discovery compliance — no test file runs in zero projects', () => {
  it('every *.test.ts(x) under src/, app/ and workers/ is claimed by a project', () => {
    const orphans = findOrphans();
    if (orphans.length > 0) {
      throw new Error(
        'These test files are run by NEITHER jest project, so their assertions ' +
          'never execute while still looking green in review:\n  ' +
          orphans.join('\n  ') +
          '\n\nMost likely cause: a *.test.ts under src/hooks/ or src/components/ ' +
          '(the node project ignores those dirs; the components project only ' +
          'matches *.test.tsx). Rename it to .tsx, or widen a project in ' +
          'jest.config.js.',
      );
    }
  });

  it('the guard itself is wired to the real config (sanity)', () => {
    expect(jestConfig.projects.map((p) => p.displayName).sort()).toEqual([
      'components',
      'node',
    ]);
    // A known-good file in each project must be claimed, or the matcher is broken.
    expect(
      jestConfig.projects.some((p) =>
        projectRuns(p, 'src/utils/__tests__/testDiscoveryCompliance.test.ts'),
      ),
    ).toBe(true);
    expect(
      jestConfig.projects.some((p) =>
        projectRuns(p, 'src/hooks/__tests__/useNotifications.test.tsx'),
      ),
    ).toBe(true);
    // And the gap this guard exists for must be detected as a gap.
    expect(
      jestConfig.projects.some((p) => projectRuns(p, 'src/hooks/__tests__/example.test.ts')),
    ).toBe(false);
  });
});
