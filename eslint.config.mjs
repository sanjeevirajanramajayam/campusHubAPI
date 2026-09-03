import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

/**
 * Modern ESLint 9 Flat Config
 * 
 * WHY:
 * 1. Replaces deprecated .eslintrc.json format with high-performance native ESM.
 * 2. Inherits strict type-aware TypeScript rules.
 * 3. Integrates eslint-config-prettier to disable any formatting conflicts.
 * 4. Ignores compiled artifacts and build outputs.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'scripts/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow ambient namespace declaration merging for Express req.user typing
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  prettierConfig
);
