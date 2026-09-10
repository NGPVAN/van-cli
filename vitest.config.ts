import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    reporters: process.env.GITHUB_ACTIONS ? ['github-actions'] : ['verbose'],
    coverage: {
      include: ['dist/**/*.js'],
      exclude: ['dist/cli.js', 'dist/types.js'],
      thresholds: {
        lines: 40,
        functions: 25,
        branches: 10,
        statements: 40,
      },
    },
  },
});
