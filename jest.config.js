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
    '^@react-native-async-storage/async-storage$': '<rootDir>/jest.mocks/async-storage.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react' } }],
  },
  // Pure-logic tests only for now; RN component tests need jest-expo preset.
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/src/components/'],
};
