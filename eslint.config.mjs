// @ts-check
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Règle d'architecture : le front n'appelle que la gateway, via le client commun.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Passer par src/lib/api (client de la gateway) au lieu de fetch direct.' },
      ],
    },
  },
  {
    // Le client de la gateway est le seul endroit autorisé à utiliser fetch.
    files: ['src/lib/api/**', '**/*.test.ts', '**/*.test.tsx', 'e2e/**'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);
