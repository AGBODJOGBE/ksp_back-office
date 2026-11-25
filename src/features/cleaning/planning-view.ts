import { beninDay, isoToBeninInput } from '@/lib/format';
import type { PlanningFilters } from './planning-api';
import type {
  AgentCheck,
  Assignment,
  AssignmentTarget,
  CheckResult,
  OverridableCheck,
  PlanningItem,
} from './planning-schemas';
import { beninDayStart } from './requests-filters';
import { addDays, type CalendarView, periodDays } from './visits-calendar';

/**
 * Planning (`/nettoyage/planning`) : vue, jour et filtres lus dans l'adresse (paramètres en français),
 * période envoyée à `GET /planning` (`from` inclus, `to` exclu, jours du Bénin), séances rangées par
 * jour, effectif, alertes des contrôles d'affectation et affectations connues de l'écran.
 */

export const PLANNING_PARAMS = {
  view: 'vue',
  day: 'date',
  agentId: 'agent',
  teamId: 'equipe',
  zoneKey: 'commune',
} as const;
export type PlanningParamKey = keyof typeof PLANNING_PARAMS;

/** Valeurs lues dans l'adresse (chaînes vides pour « tous » ; vue et jour toujours renseignés). */
export interface PlanningValues {
  view: CalendarView;
  day: string;
  agentId: string;
  teamId: string;
  zoneKey: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ZONE = /^[a-z][a-z0-9-]{1,99}$/;
/** Jour réel du calendrier (`2026-02-31` refusé). */
const isDay = (value: string) => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return DATE.test(value) && !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
};

/** Vue, jour et filtres valides de l'adresse ; une valeur hors contrat vaut « tous ». */
export function readPlanning(
  params: { get: (name: string) => string | null },
  today: string = beninDay(new Date()),
): PlanningValues {
  const get = (key: PlanningParamKey) => params.get(PLANNING_PARAMS[key]) ?? '';
  const day = get('day');
  const agentId = get('agentId');
  const teamId = get('teamId');
  const zoneKey = get('zoneKey');
  return {
    view: get('view') === 'jour' ? 'jour' : 'semaine',
    day: isDay(day) ? day : today,
    agentId: UUID.test(agentId) ? agentId : '',
    teamId: UUID.test(teamId) ? teamId : '',
    zoneKey: ZONE.test(zoneKey) ? zoneKey : '',
  };
}

/** Filtres de `GET /planning` : période affichée (jours du Bénin) et filtres posés. */
export function toPlanningFilters(values: PlanningValues): PlanningFilters {
  const days = periodDays(values);
  const filters: PlanningFilters = {
    from: beninDayStart(days[0] as string),
    to: beninDayStart(addDays(days[days.length - 1] as string, 1)),
  };
  if (values.agentId) filters.agentId = values.agentId;
  if (values.teamId) filters.teamId = values.teamId;
  if (values.zoneKey) filters.zoneKey = values.zoneKey;
  return filters;
}

/** Adresse du planning avec des valeurs modifiées (valeur vide : paramètre retiré). */
export function planningQuery(current: string, changes: Partial<PlanningValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [PlanningParamKey, string][]) {
    if (value) next.set(PLANNING_PARAMS[key], value);
    else next.delete(PLANNING_PARAMS[key]);
  }
  return next.toString();
}

export const hasPlanningFilters = (values: PlanningValues) =>
  Boolean(values.agentId || values.teamId || values.zoneKey);

/** Séances rangées par jour du Bénin, dans l'ordre de passage. */
export function itemsByDay(items: readonly PlanningItem[]): Map<string, PlanningItem[]> {
  const days = new Map<string, PlanningItem[]>();
  const sorted = [...items].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const item of sorted) {
    const day = beninDay(item.start);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return days;
}

/** Heure de début et de fin au Bénin (« 09:00 », « 12:00 »). */
export const itemTimes = (item: Pick<PlanningItem, 'start' | 'end'>) => ({
  start: isoToBeninInput(item.start).slice(11, 16),
  end: isoToBeninInput(item.end).slice(11, 16),
});

/** Agents qui comptent dans l'effectif (proposés compris) ; équipe complète ou non. */
export function staffing(item: Pick<PlanningItem, 'agents' | 'teamSize'>) {
  const count = item.agents.length;
  return { count, full: count >= item.teamSize, missing: Math.max(0, item.teamSize - count) };
}

export const targetOf = (item: Pick<PlanningItem, 'kind' | 'id'>): AssignmentTarget => ({
  kind: item.kind,
  id: item.id,
});

/** Clé d'une affectation connue de l'écran : cible et agent (le planning ne donne pas son identifiant). */
export const assignmentKey = (target: AssignmentTarget, agentId: string) =>
  `${target.kind}:${target.id}:${agentId}`;

/** Affectations actives (ni retirées, ni refusées, ni expirées) indexées par cible et agent. */
export function indexAssignments(
  current: ReadonlyMap<string, Assignment>,
  added: readonly Assignment[],
): Map<string, Assignment> {
  const next = new Map(current);
  for (const assignment of added) {
    const key = assignmentKey(assignment.target, assignment.agentId);
    if (['removed', 'declined', 'expired'].includes(assignment.status)) next.delete(key);
    else next.set(key, assignment);
  }
  return next;
}

/** Contrôles en échec d'un agent (contournés exclus). */
export const failedResults = (check: AgentCheck): CheckResult[] =>
  check.results.filter((result) => !result.passed && !result.overridden);

/** Contrôles contournables en échec dans un rapport, sans doublon, dans l'ordre du contrat. */
export function overridableFailures(checks: readonly AgentCheck[]): OverridableCheck[] {
  const found = new Set<OverridableCheck>();
  for (const check of checks) {
    for (const result of failedResults(check)) {
      if (result.overridable) found.add(result.check as OverridableCheck);
    }
  }
  return (['zone', 'availability', 'load', 'team_size'] as const).filter((check) => found.has(check));
}

/** Un contrôle non contournable a échoué : l'affectation est impossible telle quelle. */
export const hasBlockingFailure = (checks: readonly AgentCheck[]) =>
  checks.some((check) => failedResults(check).some((result) => !result.overridable));

/** Charge en heures (« 6 h 30 ») et part du maximum (0 à 100, `null` sans maximum). */
export function loadShare(planned: number, max: number) {
  const hours = Math.floor(planned / 60);
  const minutes = planned % 60;
  const label = minutes ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${hours} h`;
  return { label, percent: max > 0 ? Math.round((planned / max) * 100) : null };
}

/** Jour du Bénin (`AAAA-MM-JJ`) → début du jour en UTC, pour un champ date de formulaire. */
export const dayStart = (day: string) => beninDayStart(day);
/** Jour suivant, pour une fin exclue. */
export const nextDayStart = (day: string) => beninDayStart(addDays(day, 1));

/** Fenêtre d'une minute au début d'une intervention : relire celle-ci après une action. */
export const itemWindow = (item: Pick<PlanningItem, 'start'>) => ({
  from: item.start,
  to: new Date(Date.parse(item.start) + 60_000).toISOString(),
});

/** Adresse de la file des dossiers filtrée sur un numéro (le planning ne donne pas l'identifiant). */
export const requestSearch = (number: string) => `?${new URLSearchParams({ numero: number }).toString()}`;
