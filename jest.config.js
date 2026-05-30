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
      // NOTE: this project runs locally but is NOT yet wired into CI — Expo 54's
      // "winter" runtime (expo/src/winter/runtime*.ts) ships untransformed ESM
      // that jest's CJS runtime rejects in a clean Linux checkout ("trying to
      // import a file outside of the scope of the test code"). Needs a jest-expo
      // SDK-54 setup fix (transform/setupFile for expo/src/winter) before it can
      // gate CI. Tracked as a follow-up. Run locally with: npm run test:components
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
