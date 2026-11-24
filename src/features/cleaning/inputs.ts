/**
 * Conversions des saisies du catalogue, sans calcul métier : entiers, montants en FCFA entiers,
 * coefficients en points de base (10 000 = × 1, contrat) saisis comme un multiplicateur (« 1,15 »),
 * pourcentages en points de base (1 000 = 10 %). Tout se fait sur des chaînes et des entiers : aucun
 * nombre à virgule n'est calculé, la valeur envoyée est exactement celle saisie.
 */

const BPS_DIGITS = 4;
const PERCENT_DIGITS = 2;

/** Entier positif ou nul saisi (espaces tolérés), ou `null`. */
export function parseInteger(raw: string): number | null {
  const compact = raw.replace(/[\s  ]/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isSafeInteger(value) ? value : null;
}

/** Décimal saisi (virgule ou point) en entier à `digits` décimales : « 1,15 » → 11500 pour 4 décimales. */
function parseScaled(raw: string, digits: number): number | null {
  const compact = raw.replace(/[\s  ]/g, '').replace(',', '.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(compact);
  if (!match) return null;
  const fraction = match[2] ?? '';
  if (fraction.length > digits) return null;
  const value = Number(`${match[1]}${fraction.padEnd(digits, '0')}`);
  return Number.isSafeInteger(value) ? value : null;
}

/** Entier à `digits` décimales affiché en décimal français : 11500 → « 1,15 ». */
function formatScaled(value: number, digits: number): string {
  const sign = value < 0 ? '-' : '';
  const text = String(Math.abs(value)).padStart(digits + 1, '0');
  const whole = text.slice(0, -digits);
  const fraction = text.slice(-digits).replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `,${fraction}` : ''}`;
}

/** Multiplicateur saisi (« 1,15 ») en points de base (11500), ou `null`. */
export const parseCoefficient = (raw: string) => parseScaled(raw, BPS_DIGITS);
/** Points de base en multiplicateur à saisir : 11500 → « 1,15 ». */
export const coefficientInput = (bps: number) => formatScaled(bps, BPS_DIGITS);
/** Points de base affichés : 11500 → « × 1,15 ». */
export const formatCoefficient = (bps: number) => `× ${formatScaled(bps, BPS_DIGITS)}`;

/** Pourcentage saisi (« 12,5 ») en points de base (1250), ou `null`. */
export const parsePercentBps = (raw: string) => parseScaled(raw, PERCENT_DIGITS);
/** Points de base en pourcentage à saisir : 1250 → « 12,5 ». */
export const percentInput = (bps: number) => formatScaled(bps, PERCENT_DIGITS);
/** Points de base affichés en pourcentage : 1250 → « 12,5 % ». */
export const formatPercentBps = (bps: number) => `${formatScaled(bps, PERCENT_DIGITS)} %`;

/** Champ facultatif : texte vide → `undefined` (champ absent du corps), sinon le texte sans espaces de bord. */
export const optionalText = (raw: string): string | undefined => raw.trim() || undefined;

/**
 * Code stable proposé à partir d'un libellé (`^[a-z][a-z0-9_]{1,49}$`, contrat) : minuscules sans
 * accents, mots séparés par `_`. L'admin peut le corriger avant la création ; il ne change plus ensuite.
 */
export function codeFromLabel(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '')
    .slice(0, 50)
    .replace(/_+$/, '');
  return base.length >= 2 ? base : '';
}

export const CODE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

/** Code unique parmi `taken` : « sol », puis « sol_2 », « sol_3 »… */
export function uniqueCode(base: string, taken: readonly string[]): string {
  const root = base || 'point';
  if (!taken.includes(root)) return root;
  for (let index = 2; ; index += 1) {
    const candidate = `${root.slice(0, 46)}_${index}`;
    if (!taken.includes(candidate)) return candidate;
  }
}
