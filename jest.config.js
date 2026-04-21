/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react' } }],
  },
  // Pure-logic tests only for now; RN component tests need jest-expo preset.
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/src/components/'],
};
