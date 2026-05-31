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
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', isolatedModules: true } }],
      },
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
