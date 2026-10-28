import localFont from 'next/font/local';

/**
 * Police des titres (F-014) : une seule police variable, hébergée par le site (aucun appel externe),
 * sous-ensemble latin (français compris), axe des graisses uniquement, environ 40 Ko.
 * Police retenue : Bricolage Grotesque.
 */
export const displayFont = localFont({
  src: '../../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-ksp-display',
  fallback: ['system-ui', 'Segoe UI', 'Arial'],
  adjustFontFallback: 'Arial',
});
