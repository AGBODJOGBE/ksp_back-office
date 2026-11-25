import type { RequestFilters } from './requests-api';
import { CUSTOMER_KINDS, REQUEST_SORTS, REQUEST_STATUSES } from './requests-schemas';

/**
 * Filtres de la file des dossiers lus dans l'adresse (paramètres en français) et traduits pour
 * `GET /requests`. Une valeur hors contrat est ignorée plutôt qu'envoyée (la gateway la refuserait).
 */

export const REQUEST_PARAMS = {
  status: 'statut',
  q: 'numero',
  customerKind: 'clientele',
  communeKey: 'commune',
  placeTypeId: 'lieu',
  cleaningTypeId: 'type',
  from: 'du',
  to: 'au',
  sort: 'tri',
  customerId: 'client',
  organizationId: 'organisation',
} as const;
export type RequestFilterKey = keyof typeof REQUEST_PARAMS;

/** Valeurs des champs de filtre (chaînes vides pour « tous »). */
export type RequestFilterValues = Record<RequestFilterKey, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMMUNE = /^[a-z][a-z0-9-]{1,99}$/;
export const NUMBER_MAX = 50;
const DAY_MS = 86_400_000;

const among = (values: readonly string[]) => (value: string) => values.includes(value);

const VALID: Record<RequestFilterKey, (value: string) => boolean> = {
  status: among(REQUEST_STATUSES),
  q: (value) => value.trim().length > 0 && value.length <= NUMBER_MAX,
  customerKind: among(CUSTOMER_KINDS),
  communeKey: (value) => COMMUNE.test(value),
  placeTypeId: (value) => UUID.test(value),
  cleaningTypeId: (value) => UUID.test(value),
  from: (value) => DATE.test(value),
  to: (value) => DATE.test(value),
  sort: among(REQUEST_SORTS),
  customerId: (value) => UUID.test(value),
  organizationId: (value) => UUID.test(value),
};

const KEYS = Object.keys(REQUEST_PARAMS) as RequestFilterKey[];

/** Filtres valides de l'adresse ; un paramètre invalide vaut « tous ». */
export function readRequestFilters(params: { get: (name: string) => string | null }): RequestFilterValues {
  return Object.fromEntries(
    KEYS.map((key) => {
      const value = params.get(REQUEST_PARAMS[key]) ?? '';
      return [key, VALID[key](value) ? value : ''];
    }),
  ) as RequestFilterValues;
}

/** Début d'un jour du calendrier béninois (UTC+1 toute l'année), en ISO 8601 UTC. */
export function beninDayStart(day: string): string {
  return new Date(`${day}T00:00:00+01:00`).toISOString();
}

/** Filtres de la gateway : `from` inclus au début du jour, `to` exclu au lendemain du dernier jour. */
export function toApiFilters(values: RequestFilterValues): RequestFilters {
  const filters: RequestFilters = {};
  const set = <K extends keyof RequestFilters>(key: K, value: RequestFilters[K] | '') => {
    if (value) filters[key] = value;
  };
  set('status', values.status as RequestFilters['status']);
  set('q', values.q.trim());
  set('customerKind', values.customerKind as RequestFilters['customerKind']);
  set('communeKey', values.communeKey);
  set('placeTypeId', values.placeTypeId);
  set('cleaningTypeId', values.cleaningTypeId);
  set('customerId', values.customerId);
  set('organizationId', values.organizationId);
  set('sort', values.sort as RequestFilters['sort']);
  if (values.from) filters.from = beninDayStart(values.from);
  if (values.to) filters.to = new Date(new Date(beninDayStart(values.to)).getTime() + DAY_MS).toISOString();
  return filters;
}

/** Adresse de la file avec des filtres modifiés (valeur vide : filtre retiré). */
export function requestQuery(current: string, changes: Partial<RequestFilterValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [RequestFilterKey, string][]) {
    if (value) next.set(REQUEST_PARAMS[key], value);
    else next.delete(REQUEST_PARAMS[key]);
  }
  return next.toString();
}

/** Au moins un filtre (hors tri) est posé. */
export const hasRequestFilters = (values: RequestFilterValues) =>
  KEYS.some((key) => key !== 'sort' && values[key] !== '');
