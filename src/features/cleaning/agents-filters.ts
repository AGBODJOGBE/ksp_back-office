import type { AgentFilters } from './agents-api';
import { AGENT_SORTS, AGENT_STATUSES } from './agents-schemas';

/**
 * Filtres de la liste des agents lus dans l'adresse (paramètres en français) et traduits pour
 * `GET /agents`. Une valeur hors contrat est ignorée plutôt qu'envoyée (la gateway la refuserait).
 * Aussi : numéros de téléphone au format béninois (ADR-063).
 */

export const AGENT_PARAMS = {
  status: 'statut',
  zoneKey: 'commune',
  skillCode: 'competence',
  q: 'recherche',
  sort: 'tri',
} as const;
export type AgentFilterKey = keyof typeof AGENT_PARAMS;

/** Valeurs des champs de filtre (chaînes vides pour « tous »). */
export type AgentFilterValues = Record<AgentFilterKey, string>;

export const SEARCH_MAX = 100;
const COMMUNE = /^[a-z][a-z0-9-]{1,99}$/;
const SKILL = /^[a-z][a-z0-9_]{1,49}$/;
const among = (values: readonly string[]) => (value: string) => values.includes(value);

const VALID: Record<AgentFilterKey, (value: string) => boolean> = {
  status: among(AGENT_STATUSES),
  zoneKey: (value) => COMMUNE.test(value),
  skillCode: (value) => SKILL.test(value),
  q: (value) => value.trim().length > 0 && value.length <= SEARCH_MAX,
  sort: among(AGENT_SORTS),
};

const KEYS = Object.keys(AGENT_PARAMS) as AgentFilterKey[];

/** Filtres valides de l'adresse ; un paramètre invalide vaut « tous ». */
export function readAgentFilters(params: { get: (name: string) => string | null }): AgentFilterValues {
  return Object.fromEntries(
    KEYS.map((key) => {
      const value = params.get(AGENT_PARAMS[key]) ?? '';
      return [key, VALID[key](value) ? value : ''];
    }),
  ) as AgentFilterValues;
}

/** Filtres de la gateway (tri par nom par défaut : absent). */
export function toAgentFilters(values: AgentFilterValues): AgentFilters {
  const filters: AgentFilters = {};
  if (values.status) filters.status = values.status as AgentFilters['status'];
  if (values.zoneKey) filters.zoneKey = values.zoneKey;
  if (values.skillCode) filters.skillCode = values.skillCode;
  if (values.q.trim()) filters.q = values.q.trim();
  if (values.sort && values.sort !== 'lastName') filters.sort = values.sort as AgentFilters['sort'];
  return filters;
}

/** Adresse de la liste avec des filtres modifiés (valeur vide : filtre retiré). */
export function agentQuery(current: string, changes: Partial<AgentFilterValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [AgentFilterKey, string][]) {
    if (value) next.set(AGENT_PARAMS[key], value);
    else next.delete(AGENT_PARAMS[key]);
  }
  return next.toString();
}

/** Au moins un filtre (hors tri) est posé. */
export const hasAgentFilters = (values: AgentFilterValues) =>
  KEYS.some((key) => key !== 'sort' && values[key] !== '');

// --- Téléphones (ADR-063) ------------------------------------------------------------------------

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Numéro saisi en E.164, ou `null`. Au Bénin, la numérotation est passée à 10 chiffres en ajoutant
 * `01` devant les 8 chiffres (ADR-063) : « 01 97 00 00 45 » et « +229 97 00 00 45 » donnent tous deux
 * `+2290197000045`. Un numéro international d'un autre pays est pris tel quel. La gateway reste juge.
 */
export function toBeninE164(raw: string): string | null {
  let value = raw.replace(/[\s.\-()/ ]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (!value.startsWith('+')) {
    if (/^01\d{8}$/.test(value)) return `+229${value}`;
    if (/^\d{8}$/.test(value)) return `+22901${value}`;
    return null;
  }
  if (value.startsWith('+229')) {
    const national = value.slice(4);
    if (/^01\d{8}$/.test(national)) return value;
    if (/^\d{8}$/.test(national)) return `+22901${national}`;
    return null;
  }
  return E164.test(value) ? value : null;
}

/** « +229 01 97 00 00 45 » pour un numéro béninois à 10 chiffres ; tout autre numéro tel quel. */
export function formatPhone(e164: string): string {
  const match = /^\+229(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return match ? `+229 ${match.slice(1).join(' ')}` : e164;
}
