import type { ClaimFilters } from './claims-api';
import { CLAIM_SORTS, CLAIM_STATUSES } from './claims-schemas';

/**
 * Filtres de la file des réclamations lus dans l'adresse (paramètres en français) et traduits pour
 * `GET /claims`. Une valeur hors contrat est ignorée plutôt qu'envoyée (la gateway la refuserait).
 */

export const CLAIM_PARAMS = {
  status: 'statut',
  agentId: 'agent',
  customerId: 'client',
  organizationId: 'organisation',
  sort: 'tri',
} as const;
export type ClaimFilterKey = keyof typeof CLAIM_PARAMS;

/** Valeurs des champs de filtre (chaînes vides pour « tous »). */
export type ClaimFilterValues = Record<ClaimFilterKey, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const among = (values: readonly string[]) => (value: string) => values.includes(value);
const uuid = (value: string) => UUID.test(value);

const VALID: Record<ClaimFilterKey, (value: string) => boolean> = {
  status: among(CLAIM_STATUSES),
  agentId: uuid,
  customerId: uuid,
  organizationId: uuid,
  sort: among(CLAIM_SORTS),
};

const KEYS = Object.keys(CLAIM_PARAMS) as ClaimFilterKey[];

/** Filtres valides de l'adresse ; un paramètre invalide vaut « tous ». */
export function readClaimFilters(params: { get: (name: string) => string | null }): ClaimFilterValues {
  return Object.fromEntries(
    KEYS.map((key) => {
      const value = params.get(CLAIM_PARAMS[key]) ?? '';
      return [key, VALID[key](value) ? value : ''];
    }),
  ) as ClaimFilterValues;
}

/** Filtres de la gateway : seules les valeurs posées sont envoyées. */
export function toClaimApiFilters(values: ClaimFilterValues): ClaimFilters {
  const filters: Record<string, string> = {};
  for (const key of KEYS) if (values[key]) filters[key] = values[key];
  return filters as ClaimFilters;
}

/** Adresse de la file avec des filtres modifiés (valeur vide : filtre retiré). */
export function claimQuery(current: string, changes: Partial<ClaimFilterValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [ClaimFilterKey, string][]) {
    if (value) next.set(CLAIM_PARAMS[key], value);
    else next.delete(CLAIM_PARAMS[key]);
  }
  return next.toString();
}

/** Au moins un filtre (hors tri) est posé. */
export const hasClaimFilters = (values: ClaimFilterValues) =>
  KEYS.some((key) => key !== 'sort' && values[key] !== '');

/** Adresse de la file filtrée sur un statut (raccourcis de « Ma journée »). */
export const claimsByStatus = (base: string, status: 'open' | 'in_progress') =>
  `${base}?${CLAIM_PARAMS.status}=${status}`;
