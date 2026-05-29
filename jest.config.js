/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Node-side stubs for the three RN-flavored modules that src/ai/** and
    // src/utils/** depend on. Keeps the eval harness in pure Node without
    // dragging in jest-expo / babel-preset-expo.
    '^react-native$': '<rootDir>/jest.mocks/react-native.ts',
    '^expo-constants$': '<rootDir>/jest.mocks/expo-constants.ts',
    '^expo-crypto$': '<rootDir>/jest.mocks/expo-crypto.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/jest.mocks/async-storage.ts',
  },
  transform: {
    // `isolatedModules` moved into the inline tsconfig (ts-jest deprecated the
    // top-level option). Scoped to the test transform only — does NOT touch the
    // app's tsconfig.json, so `tsc --noEmit` behaviour is unchanged.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react', isolatedModules: true } }],
  },
  // Pure-logic tests only for now; RN component tests need jest-expo preset.
  // `.claude/worktrees/**` holds throwaway agent worktrees with their own
  // duplicate test files — exclude them so they don't pollute discovery + counts.
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/src/components/', '/\\.claude/'],
};
