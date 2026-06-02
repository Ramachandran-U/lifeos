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
  // Regression guard for the sync engine (P1). Scoped to src/sync so `--coverage`
  // stays fast and the bar targets the data-integrity core. Native expo-sqlite
  // paths in sink.ts/backup.ts can't run under jest-node (device-smoke-tested),
  // so the bar accounts for them. Enforced in CI via `npm test -- --coverage`.
  collectCoverageFrom: ['src/sync/**/*.ts', '!src/sync/**/__tests__/**'],
  // `global` = the aggregate over the collected files (scoped to src/sync above),
  // i.e. a directory-level floor — not per-file, so the device-only native paths
  // in sink.ts/backup.ts don't sink the bar while the core stays well-covered.
  coverageThreshold: {
    global: { lines: 76, statements: 73, branches: 60, functions: 62 },
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
      testPathIgnorePatterns: [...IGNORE, '/app/', '/src/components/'],
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
      // where the path mixes \ and /. Matches src/components/**/*.test.tsx.
      testMatch: ['**/src/components/**/*.test.tsx'],
      // @/ alias merges with jest-expo's asset mocks. The node-suite RN stubs
      // are intentionally NOT here — the component suite uses the real
      // react-native via jest-expo.
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testPathIgnorePatterns: IGNORE,
    },
  ],
};
