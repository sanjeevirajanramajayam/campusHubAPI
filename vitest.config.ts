import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration with V8 Code Coverage Engine
 * 
 * WHY:
 * 1. Native ESM and TypeScript test runner (zero compilation step needed).
 * 2. V8 Coverage Provider for sub-second coverage analysis.
 * 3. Exports LCOV reports for Codecov / CI pipeline status checks.
 * 4. Generates an interactive HTML coverage report under `coverage/index.html`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/app.ts',
        'src/infrastructure/**',
        'src/**/*.dto.ts',
        'src/**/*.interface.ts',
      ],
      // Threshold enforcement: Guarantees coverage never regresses
      thresholds: {
        lines: 50,
        functions: 45,
        branches: 55,
        statements: 50,
      },
    },
  },
});
