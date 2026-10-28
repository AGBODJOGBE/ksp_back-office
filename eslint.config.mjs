// @ts-check
import { readdirSync } from 'node:fs';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/*
 * Frontières de l'architecture (F-012, docs/architecture.md). Chaque motif interdit un import ;
 * les blocs sont composés parce qu'une règle redéfinie dans un bloc plus précis remplace la précédente.
 */
const TESTS = ['**/*.test.ts', '**/*.test.tsx'];

/** Imports relatifs limités au dossier courant (`./`) : au-delà, l'alias `@/` rend la frontière visible. */
const NO_PARENT = {
  regex: '^\\.\\.(/|$)',
  message: 'Import relatif limité au dossier courant : utiliser @/.',
};

/**
 * Une fonctionnalité ne s'importe que par son API publique : `@/features/<domaine>`, ou ses points d'entrée
 * secondaires `/server` (serveur uniquement) et `/session` (cadre des pages connectées, sans le parcours de connexion).
 */
const featureInternals = (/** @type {string} */ self = '') => ({
  regex: `^@/features/${self ? `(?!${self}/)` : ''}[^/]+/(?!(server|session)$).+`,
  message: 'Importer une fonctionnalité par son API publique : @/features/<domaine>.',
});

/** Dans une fonctionnalité, ses propres fichiers s'importent directement, jamais par son index (cycles). */
const selfIndex = (/** @type {string} */ self) => ({
  regex: `^@/features/${self}(/(server|session))?$`,
  message: 'Dans sa propre fonctionnalité, importer le fichier voulu (@/features/<domaine>/…), pas l’index.',
});

/** Les routes composent ; rien ne dépend d'elles. */
const NO_APP = {
  regex: '^@/app(/|$)',
  message: 'Rien n’importe src/app : les routes composent, elles ne fournissent rien.',
};

/** Les briques transverses ne connaissent aucune fonctionnalité. */
const NO_FEATURES = {
  regex: '^@/features(/|$)',
  message: 'Les briques transverses (components, lib, config, i18n) ne dépendent d’aucune fonctionnalité.',
};

/** lib, config et i18n restent sous les composants. */
const NO_COMPONENTS = {
  regex: '^@/components(/|$)',
  message: 'lib, config et i18n n’importent aucun composant.',
};

/** components/ui est le futur paquet ksp-ui (F-003) : il ne connaît ni le site, ni ses textes, ni sa configuration. */
const UI_PORTABLE = {
  regex: '^@/(components/(?!ui/)|config(/|$)|i18n(/|$))',
  message: 'components/ui (futur ksp-ui) n’importe que components/ui et lib.',
};

const restrict = (/** @type {object[]} */ ...patterns) => ['error', { patterns }];

/** Fonctionnalités présentes : chacune reçoit ses propres règles (accès libre à ses fichiers internes). */
const features = readdirSync(new URL('./src/features', import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

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
  // Partout dans src : pas de remontée relative, pas d'accès à l'intérieur d'une fonctionnalité.
  { files: ['src/**'], rules: { 'no-restricted-imports': restrict(NO_PARENT, featureInternals()) } },
  // Une fonctionnalité : libre chez elle, API publique chez les autres, jamais de src/app (sauf ses tests).
  ...features.flatMap((feature) => [
    {
      files: [`src/features/${feature}/**`],
      rules: {
        'no-restricted-imports': restrict(NO_PARENT, featureInternals(feature), selfIndex(feature)),
      },
    },
    {
      files: [`src/features/${feature}/**`],
      ignores: TESTS,
      rules: {
        'no-restricted-imports': restrict(NO_PARENT, featureInternals(feature), selfIndex(feature), NO_APP),
      },
    },
  ]),
  // Composants partagés : aucune fonctionnalité, aucune route. Les tests peuvent prendre de vrais contenus.
  {
    files: ['src/components/**'],
    ignores: TESTS,
    rules: { 'no-restricted-imports': restrict(NO_PARENT, NO_FEATURES, NO_APP) },
  },
  {
    files: ['src/components/ui/**'],
    ignores: TESTS,
    rules: { 'no-restricted-imports': restrict(NO_PARENT, NO_FEATURES, NO_APP, UI_PORTABLE) },
  },
  // Technique transverse et configuration : sous tout le reste.
  {
    files: ['src/lib/**', 'src/config/**', 'src/i18n/**'],
    ignores: TESTS,
    rules: { 'no-restricted-imports': restrict(NO_PARENT, NO_FEATURES, NO_APP, NO_COMPONENTS) },
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
