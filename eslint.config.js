// Flat config — ESLint 9+
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**',
      '**/coverage/**', '**/test-results/**', '**/playwright-report/**',
      '**/.expo/**', '**/.turbo/**', '**/screenshots/**',
      'pnpm-lock.yaml',
      '**/sw.ts', '**/sw.js', '**/service-worker.ts',
      'apps/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { self: 'readonly', console: 'readonly', URL: 'readonly', Request: 'readonly', Response: 'readonly', fetch: 'readonly', crypto: 'readonly', globalThis: 'readonly', process: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-useless-assignment': 'off',
      'no-undef': 'off',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**/*.ts', 'scripts/**/*'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
