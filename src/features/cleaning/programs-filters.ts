import type { ProgramFilters } from './programs-api';
import { PROGRAM_SORTS, PROGRAM_STATUSES } from './programs-schemas';
import { CUSTOMER_KINDS } from './requests-schemas';

/**
 * Filtres de la liste des programmes lus dans l'adresse (paramètres en français) et traduits pour
 * `GET /programs`. Une valeur hors contrat est ignorée plutôt qu'envoyée (la gateway la refuserait).
 */

export const PROGRAM_PARAMS = {
  status: 'statut',
  q: 'numero',
  payerKind: 'payeur',
  communeKey: 'commune',
  sort: 'tri',
  customerId: 'client',
  organizationId: 'organisation',
} as const;
export type ProgramFilterKey = keyof typeof PROGRAM_PARAMS;

/** Valeurs des champs de filtre (chaînes vides pour « tous »). */
export type ProgramFilterValues = Record<ProgramFilterKey, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMUNE = /^[a-z][a-z0-9-]{1,99}$/;
export const PROGRAM_NUMBER_MAX = 50;

const among = (values: readonly string[]) => (value: string) => values.includes(value);

const VALID: Record<ProgramFilterKey, (value: string) => boolean> = {
  status: among(PROGRAM_STATUSES),
  q: (value) => value.trim().length > 0 && value.length <= PROGRAM_NUMBER_MAX,
  payerKind: among(CUSTOMER_KINDS),
  communeKey: (value) => COMMUNE.test(value),
  sort: among(PROGRAM_SORTS),
  customerId: (value) => UUID.test(value),
  organizationId: (value) => UUID.test(value),
};

const KEYS = Object.keys(PROGRAM_PARAMS) as ProgramFilterKey[];

/** Filtres valides de l'adresse ; un paramètre invalide vaut « tous ». */
export function readProgramFilters(params: { get: (name: string) => string | null }): ProgramFilterValues {
  return Object.fromEntries(
    KEYS.map((key) => {
      const value = params.get(PROGRAM_PARAMS[key]) ?? '';
      return [key, VALID[key](value) ? value : ''];
    }),
  ) as ProgramFilterValues;
}

/** Filtres de la gateway : seules les valeurs posées sont envoyées. */
export function toProgramApiFilters(values: ProgramFilterValues): ProgramFilters {
  const filters: Record<string, string> = {};
  for (const key of KEYS) {
    const value = key === 'q' ? values.q.trim() : values[key];
    if (value) filters[key] = value;
  }
  return filters as ProgramFilters;
}

/** Adresse de la liste avec des filtres modifiés (valeur vide : filtre retiré). */
export function programQuery(current: string, changes: Partial<ProgramFilterValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [ProgramFilterKey, string][]) {
    if (value) next.set(PROGRAM_PARAMS[key], value);
    else next.delete(PROGRAM_PARAMS[key]);
  }
  return next.toString();
}

/** Au moins un filtre (hors tri) est posé. */
export const hasProgramFilters = (values: ProgramFilterValues) =>
  KEYS.some((key) => key !== 'sort' && values[key] !== '');
