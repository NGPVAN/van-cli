/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'dist/**/*.js',
    '!dist/cli.js',
    '!dist/types.js',
  ],
  coverageThreshold: {
    global: {
      lines: 40,
      functions: 25,
      branches: 10,
      statements: 40,
    },
  },
};
