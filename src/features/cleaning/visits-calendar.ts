import { beninDay, isoToBeninInput } from '@/lib/format';
import type { VisitFilters } from './requests-api';
import { beninDayStart } from './requests-filters';
import { VISIT_STATUSES, type Visit } from './requests-schemas';

/**
 * Calendrier des visites (`/nettoyage/visites`) : vue, jour affiché et filtres lus dans l'adresse
 * (paramètres en français), période envoyée à `GET /visits` (`from` inclus, `to` exclu), visites
 * rangées par jour et par heure. Jours et heures au Bénin (UTC+1 toute l'année, sans heure d'été).
 */

export const CALENDAR_VIEWS = ['jour', 'semaine'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const VISIT_PARAMS = {
  view: 'vue',
  day: 'date',
  status: 'statut',
  agentId: 'agent',
  communeKey: 'commune',
} as const;
export type VisitParamKey = keyof typeof VISIT_PARAMS;

/** Valeurs lues dans l'adresse (chaînes vides pour « tous » ; vue et jour toujours renseignés). */
export interface CalendarValues {
  view: CalendarView;
  day: string;
  status: string;
  agentId: string;
  communeKey: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COMMUNE = /^[a-z][a-z0-9-]{1,99}$/;
const DAY_MS = 86_400_000;
/** Heures toujours montrées par la grille horaire (écran large), élargies aux visites hors plage. */
const FIRST_HOUR = 7;
const LAST_HOUR = 19;

const isDay = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Jour décalé de `count` jours (`2026-11-30` + 1 → `2026-12-01`). */
export function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

/** Lundi de la semaine du jour donné. */
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Vue, jour et filtres valides de l'adresse ; une valeur hors contrat vaut « tous ». */
export function readCalendar(
  params: { get: (name: string) => string | null },
  today: string = beninDay(new Date()),
): CalendarValues {
  const get = (key: VisitParamKey) => params.get(VISIT_PARAMS[key]) ?? '';
  const view = get('view');
  const day = get('day');
  const status = get('status');
  const agentId = get('agentId');
  const communeKey = get('communeKey');
  return {
    view: view === 'jour' ? 'jour' : 'semaine',
    day: isDay(day) ? day : today,
    status: (VISIT_STATUSES as readonly string[]).includes(status) ? status : '',
    agentId: UUID.test(agentId) ? agentId : '',
    communeKey: COMMUNE.test(communeKey) ? communeKey : '',
  };
}

/** Jours affichés : le jour seul, ou la semaine du lundi au dimanche. */
export function periodDays(values: Pick<CalendarValues, 'view' | 'day'>): string[] {
  if (values.view === 'jour') return [values.day];
  const first = weekStart(values.day);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Filtres de la gateway : période affichée et filtres posés. */
export function toVisitFilters(values: CalendarValues): VisitFilters {
  const days = periodDays(values);
  const filters: VisitFilters = {
    from: beninDayStart(days[0] as string),
    to: beninDayStart(addDays(days[days.length - 1] as string, 1)),
  };
  if (values.status) filters.status = values.status as VisitFilters['status'];
  if (values.agentId) filters.agentId = values.agentId;
  if (values.communeKey) filters.communeKey = values.communeKey;
  return filters;
}

/** Jour affiché après « précédent » (-1) ou « suivant » (+1) : un jour ou une semaine. */
export const shiftDay = (values: Pick<CalendarValues, 'view' | 'day'>, direction: -1 | 1) =>
  addDays(values.day, direction * (values.view === 'jour' ? 1 : 7));

/** Adresse du calendrier avec des valeurs modifiées (valeur vide : paramètre retiré). */
export function calendarQuery(current: string, changes: Partial<CalendarValues>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes) as [VisitParamKey, string][]) {
    if (value) next.set(VISIT_PARAMS[key], value);
    else next.delete(VISIT_PARAMS[key]);
  }
  return next.toString();
}

/** Au moins un filtre posé (hors vue et jour). */
export const hasVisitFilters = (values: CalendarValues) =>
  Boolean(values.status || values.agentId || values.communeKey);

/** Heure de début et de fin au Bénin (« 09:00 », « 10:30 »). */
export function visitTimes(visit: Pick<Visit, 'scheduledAt' | 'durationMinutes'>) {
  const end = new Date(Date.parse(visit.scheduledAt) + visit.durationMinutes * 60_000).toISOString();
  return { start: isoToBeninInput(visit.scheduledAt).slice(11, 16), end: isoToBeninInput(end).slice(11, 16) };
}

const hourOf = (visit: Visit) => Number(isoToBeninInput(visit.scheduledAt).slice(11, 13));

/** Visites rangées par jour du Bénin, dans l'ordre de passage. */
export function visitsByDay(visits: readonly Visit[]): Map<string, Visit[]> {
  const days = new Map<string, Visit[]>();
  const sorted = [...visits].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  for (const visit of sorted) {
    const day = beninDay(visit.scheduledAt);
    days.set(day, [...(days.get(day) ?? []), visit]);
  }
  return days;
}

/** Heures de la grille : 7 h à 19 h, élargies aux visites prévues plus tôt ou plus tard. */
export function gridHours(visits: readonly Visit[]): number[] {
  const hours = visits.map(hourOf);
  const first = Math.min(FIRST_HOUR, ...hours);
  const last = Math.max(LAST_HOUR, ...hours);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/** Visites d'un jour qui commencent dans l'heure donnée. */
export const visitsAt = (visits: readonly Visit[], hour: number) =>
  visits.filter((visit) => hourOf(visit) === hour);
