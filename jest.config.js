/** @type {import('jest').Config} */

// Two projects, both run by `npm test`:
//  • node       — the original pure-logic suite (ts-jest, Node env). Unchanged.
//  • components — RN component render tests (jest-expo + @testing-library/
//                 react-native) for src/components/**/*.test.tsx. This is what
//                 lets us behaviour-test Button/EmptyState/DomainGlyph etc.,
//                 which the node suite can't (it stubs react-native).
//
// `.claude/worktrees/**` holds throwaway agent worktrees with duplicate tests —
// excluded from both so they don't pollute discovery + counts.

const IGNORE = ['/node_modules/', '/\\.claude/'];

// Pull jest-expo's own setupFiles so we can prepend our winter-runtime fix
// without dropping the preset's react-native + expo setup (a project's
// `setupFiles` REPLACES the preset's rather than merging).
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  // Coverage RATCHET. Each glob's floor is set a few points UNDER the measured %
  // (run-to-run noise can't red CI). It is a ONE-WAY ratchet: PRs may RAISE a
  // floor, never lower it without explicit justification. Most-specific glob
  // wins, so the strong sub-areas (ai/agent, ai/prompts) keep a high bar while
  // the noisier parent (ai/client.ts, functions.ts) clears a lower one. Floors
  // are directory aggregates — native-only paths (expo-sqlite in db/*, sink/
  // backup) and other device-smoke code stay device-tested, so the dir bar
  // accounts for them. Enforced in CI via `npm test -- --coverage`.
  //
  // 0%-today areas are intentionally NOT collected yet (locking in 0% is a no-op
  // gate that makes the aggregate look defended): src/hooks and
  // src/integrations/{supabase,elevenlabs,googleFit-not... }. Bring them in per
  // phase once starter specs exist (see the test-coverage expansion plan).
  // src/components IS now collected (A-P1 landed 160 component tests) — it is
  // instrumented by the `components` project ONLY; the `node` project ignores it
  // via coveragePathIgnorePatterns so the two instrumenters don't dilute each
  // other (the same split that already keeps the logic dirs measured by `node`).
  collectCoverageFrom: [
    'src/sync/**/*.ts',
    'src/cognition/**/*.ts',
    'src/explore/**/*.ts',
    'src/ai/**/*.ts',
    'src/utils/**/*.{ts,tsx}',
    'src/finance/**/*.{ts,tsx}',
    'src/db/**/*.ts',
    'src/store/**/*.ts',
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.ts',
    'src/integrations/google/**/*.ts',
    'src/integrations/googleCalendar/**/*.ts',
    'src/integrations/googleFit/**/*.ts',
    'src/integrations/googleAuth/**/*.ts',
    'src/integrations/youtube/**/*.ts',
    'src/integrations/googleContacts/**/*.ts',
    'workers/ai-proxy/src/**/*.ts',
    '!**/__tests__/**',
    '!src/**/*.d.ts',
  ],
  // DIRECTORY-path keys (trailing slash), NOT globs: jest aggregates coverage
  // over each directory and applies the MOST-SPECIFIC matching key, so a
  // directory's average is what's gated (glob keys are checked per-file, which
  // would red on the native-only files like sink.ts/backup.ts). Floors sit a few
  // points under the measured directory aggregate.
  coverageThreshold: {
    './src/sync/': { lines: 76, statements: 73, branches: 60, functions: 62 },
    './src/cognition/': { lines: 90, branches: 82, functions: 85 },
    './src/explore/': { lines: 76, branches: 62, functions: 78 },
    './src/ai/agent/': { lines: 86, branches: 70, functions: 76 },
    './src/ai/prompts/': { lines: 90 }, // string constants — no branches/functions
    // Raised 2026-06-09: profileMerge / profileLearning / behaviourApply /
    // routinePlanner / replanApply / historyContext / profileContext tests added.
    // Measured aggregate (node project): ~68% lines, ~60% branches, ~66% functions.
    './src/ai/': { lines: 63, branches: 54, functions: 60 },
    './src/utils/': { lines: 46, branches: 36, functions: 34 },
    // Lowered from 92/85/92 at the merge: #114's Gmail-bills code under
    // finance/db pulled the merged-tree aggregate down to ~80/74/69.
    './src/finance/db/': { lines: 78, branches: 70, functions: 66 },
    './src/finance/': { lines: 40, branches: 32, functions: 36 },
    // db/queries is the user-data write path. Floors raised to sit just under the
    // now-deterministic measured aggregate (tight buffers are safe because the CI
    // gate runs --runInBand; see the CI workflow). Branch coverage here is still
    // low in absolute terms — raising it further needs new query-layer tests,
    // tracked as a follow-up.
    './src/db/queries/': { lines: 31, branches: 12, functions: 23 },
    './src/db/webStorage/': { lines: 90, branches: 72, functions: 88 },
    './src/db/': { lines: 34 },
    './src/store/': { lines: 40, branches: 28, functions: 40 },
    // src/components — folded into the gate (A-P1/A-P2 added ~160 component tests).
    // Single aggregate floor a few points under the measured aggregate; measured
    // by the `components` project only (the node project ignores it — see
    // coveragePathIgnorePatterns). A wider buffer than the logic dirs because this
    // is the actively-refactored UI surface. Per-subdir floors can layer on later
    // as most-specific keys once the 0%-today areas (profile, ambient) get specs.
    './src/components/': { lines: 27, branches: 27, functions: 22 },
    // src/hooks — raised 2026-06-09: useDailyBriefing + 7 other hook suites.
    // Measured aggregate (components project): ~33% lines, ~35% branches, ~28% functions.
    './src/hooks/': { lines: 32, branches: 30, functions: 26 },
    './src/integrations/google/': { lines: 58, branches: 55, functions: 38 },
    // Raised 2026-06-04: the read path (listCalendarEvents) lifted this dir to
    // ~88/75/100 (lines/branches/functions); floor a few points under.
    './src/integrations/googleCalendar/': { lines: 82, branches: 68, functions: 92 },
    './src/integrations/googleFit/': { lines: 78, branches: 44, functions: 78 },
    './src/integrations/googleAuth/': { lines: 44 },
    // Folded into the gate 2026-06-05: client (paginate/parse) + oauth-binding
    // tests put both dirs at ~100% lines/funcs; floors sit a few points under the
    // measured aggregate (youtube client branch 82%, contacts client branch 96%).
    './src/integrations/youtube/': { lines: 90, branches: 76, functions: 90 },
    './src/integrations/googleContacts/': { lines: 90, branches: 88, functions: 90 },
    './workers/ai-proxy/src/': { lines: 24, branches: 16, functions: 32 },
  },
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(test).ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Node-side stubs for the RN-flavored modules src/ai/** & src/utils/**
        // depend on. Keeps the logic suite in pure Node (no babel-preset-expo).
        '^react-native$': '<rootDir>/jest.mocks/react-native.ts',
        '^expo-constants$': '<rootDir>/jest.mocks/expo-constants.ts',
        '^expo-crypto$': '<rootDir>/jest.mocks/expo-crypto.ts',
        '^@react-native-async-storage/async-storage$': '<rootDir>/jest.mocks/async-storage.ts',
      },
      transform: {
        '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: { jsx: 'react', isolatedModules: true, allowJs: true } }],
      },
      // @noble/{ciphers,hashes} ship pure ESM with no CJS build, so the
      // ts-jest/CJS node suite must transform them (everything else in
      // node_modules stays ignored).
      transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
      // app/** stays out of the node suite (screens need the components env) —
      // EXCEPT app/(tabs)/__tests__/, which holds pure fs source-guard tests
      // (hierarchyGuards.test.ts, Ink + Signal W4 §3.0.2/AC7) with no RN imports.
      testPathIgnorePatterns: [...IGNORE, '/app/(?!\\(tabs\\)/__tests__/)', '/src/components/', '/src/hooks/'],
      // src/components and src/hooks are measured by the `components` project ONLY.
      // The node suite stubs react-native so it can't run component or hook tests.
      // Without this it would emit 0%-coverage maps that dilute per-directory numbers.
      coveragePathIgnorePatterns: [...IGNORE, '/app/', '/src/components/', '/src/hooks/'],
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      // Expo 54's "winter" runtime installs a lazy `__ExpoImportMetaRegistry`
      // global getter that fires a deferred require() at access time, which
      // jest rejects ("import a file outside of the scope of the test code").
      // jest.setup.winter.js stubs that module so the suite runs in a clean
      // checkout / CI. See the file header and issue #70 for the mechanism.
      // Prepended to the preset's own setupFiles (which we must re-list, since
      // a project's setupFiles replaces — not merges with — the preset's).
      setupFiles: ['<rootDir>/jest.setup.winter.js', ...expoPreset.setupFiles],
      // Relative glob (not <rootDir>/…) — an absolute glob breaks on Windows
      // where the path mixes \ and /. Matches src/components/**/*.test.tsx and
      // src/hooks/**/*.test.tsx (hooks need renderHook from the jest-expo env).
      // src/screens added for the Ink + Signal W4 legacy-snapshot suite (AC12)
      // — the *.legacy.tsx trees render under this project's jest-expo env.
      testMatch: ['**/src/components/**/*.test.tsx', '**/src/hooks/**/*.test.tsx', '**/src/screens/**/*.test.tsx'],
      // @/ alias merges with jest-expo's asset mocks. The node-suite RN stubs
      // are intentionally NOT here — the component suite uses the real
      // react-native via jest-expo. AsyncStorage IS stubbed (mirroring the node
      // project): component tests that reach the store/telemetry chain (e.g. the
      // rabbit-hole map, which imports the AI client transitively) would
      // otherwise hit the unlinked native module and fail to load.
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@react-native-async-storage/async-storage$': '<rootDir>/jest.mocks/async-storage.ts',
      },
      testPathIgnorePatterns: IGNORE,
      // Coverage from this project is for src/components ONLY. Component tests
      // import the logic dirs (sync/db/store/ai/…) transitively via the store
      // chain; letting jest-expo's babel instrument them too — merged with the
      // node project's ts-jest instrumentation — DILUTES the per-directory
      // numbers the coverage gate checks (e.g. src/sync 82%→71% lines, 68%→49%
      // branches). Ignoring those paths here keeps each gated dir measured by
      // the node project alone, i.e. its true coverage. (coveragePathIgnore
      // overrides collectCoverageFrom.)
      coveragePathIgnorePatterns: [
        ...IGNORE,
        '/src/sync/', '/src/db/', '/src/store/', '/src/ai/', '/src/utils/',
        '/src/finance/', '/src/explore/', '/src/cognition/', '/src/integrations/',
        '/workers/',
        // src/hooks IS measured here (hooks need jest-expo's renderHook env).
        // The node project ignores hooks via testPathIgnorePatterns so they
        // are instrumented by this project only, avoiding double-counting.
      ],
    },
  ],
};
