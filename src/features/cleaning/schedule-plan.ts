import { parseInteger } from './inputs';
import type { SchedulePlanValue } from './requests-schemas';
import { simulatorTexts } from './simulator-texts';

/**
 * Plan des séances (`CleaningSchedulePlan`, partie 8) : description lisible et brouillon d'un
 * formulaire (changement d'horaire, avenant). Le brouillon couvre la date unique, la semaine et les
 * jours du mois, comme le simulateur ; les autres champs du plan (dates exclues ou ajoutées, rangs
 * « premier lundi ») ne s'y modifient pas.
 */

const s = simulatorTexts;
const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const RANKS: Record<string, string> = {
  first: 'premier',
  second: 'deuxième',
  third: 'troisième',
  fourth: 'quatrième',
  last: 'dernier',
};

const weekdayName = (code: string) =>
  ((s.weekdayNames as Record<string, string>)[code] ?? code).toLowerCase();

/** Fréquence d'un plan en une phrase : « Toutes les 2 semaines (lundi, jeudi) à 09:00, pendant 12 semaines ». */
export function describeSchedule(plan: SchedulePlanValue): string {
  const at = `à ${plan.startTime}`;
  if (plan.kind === 'one_off') {
    const count = plan.dates?.length ?? 0;
    return `Ponctuel : ${count > 1 ? `${count} dates` : `${count} date`}, ${at}`;
  }
  if (plan.kind === 'weekly') {
    const every = plan.everyWeeks ?? 1;
    const head = every > 1 ? `Toutes les ${every} semaines` : 'Chaque semaine';
    const days = (plan.weekdays ?? []).map(weekdayName).join(', ');
    const span = plan.durationWeeks ? `, pendant ${plan.durationWeeks} semaines` : '';
    return `${head}${days ? ` (${days})` : ''} ${at}${span}`;
  }
  const days = plan.monthDays?.length ? `le ${plan.monthDays.join(', ')}` : '';
  const ranks = (plan.monthWeekdays ?? [])
    .map((item) => `le ${RANKS[item.rank] ?? item.rank} ${weekdayName(item.weekday)}`)
    .join(', ');
  const which = [days, ranks].filter(Boolean).join(', ');
  const span = plan.durationMonths ? `, pendant ${plan.durationMonths} mois` : '';
  return `Chaque mois${which ? `, ${which}` : ''} ${at}${span}`;
}

export type ScheduleKind = 'none' | SchedulePlanValue['kind'];

/** Saisie d'un plan (textes des champs) ; `none` : aucun plan (avenant sans séances ajoutées). */
export interface ScheduleDraft {
  kind: ScheduleKind;
  date: string;
  startDate: string;
  startTime: string;
  weekdays: string[];
  everyWeeks: string;
  durationWeeks: string;
  monthDays: string;
  durationMonths: string;
  excludeHolidays: boolean;
}

const text = (value: number | undefined) => (value === undefined ? '' : String(value));

/** Brouillon prérempli avec un plan existant, ou vide (`none`). */
export function scheduleDraftOf(plan?: SchedulePlanValue | null): ScheduleDraft {
  return {
    kind: plan?.kind ?? 'none',
    date: plan?.dates?.[0] ?? '',
    startDate: plan?.startDate ?? '',
    startTime: plan?.startTime ?? '09:00',
    weekdays: [...(plan?.weekdays ?? [])],
    everyWeeks: text(plan?.everyWeeks ?? 1),
    durationWeeks: text(plan?.durationWeeks),
    monthDays: (plan?.monthDays ?? []).join(', '),
    durationMonths: text(plan?.durationMonths),
    excludeHolidays: plan?.excludeHolidays ?? true,
  };
}

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function monthDaysOf(raw: string): number[] | null {
  const days = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseInteger);
  if (!days.length || days.some((day) => day === null || day < 1 || day > 31)) return null;
  return [...new Set(days as number[])];
}

/** Contrôles locaux, clés au chemin du contrat préfixé (`schedule.startTime`, `addSchedule.weekdays`). */
export function scheduleErrors(
  draft: ScheduleDraft,
  prefix: string,
  required: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.kind === 'none') return errors;
  const between = (min: number, max: number) => `Entre ${min} et ${max}.`;
  if (!TIME.test(draft.startTime)) errors[`${prefix}.startTime`] = s.invalidTime;
  if (draft.kind === 'one_off' && !draft.date) errors[`${prefix}.dates`] = required;
  if (draft.kind !== 'one_off' && !draft.startDate) errors[`${prefix}.startDate`] = required;
  if (draft.kind === 'weekly') {
    if (!draft.weekdays.length) errors[`${prefix}.weekdays`] = s.chooseWeekday;
    const every = parseInteger(draft.everyWeeks);
    if (every === null || every < 1 || every > 12) errors[`${prefix}.everyWeeks`] = between(1, 12);
    const weeks = parseInteger(draft.durationWeeks);
    if (weeks === null || weeks < 1 || weeks > 260) errors[`${prefix}.durationWeeks`] = between(1, 260);
  }
  if (draft.kind === 'monthly') {
    if (!monthDaysOf(draft.monthDays)) errors[`${prefix}.monthDays`] = s.invalidDays;
    const months = parseInteger(draft.durationMonths);
    if (months === null || months < 1 || months > 60) errors[`${prefix}.durationMonths`] = between(1, 60);
  }
  return errors;
}

/** Plan envoyé à la gateway (après `scheduleErrors`) ; `undefined` pour `none`. */
export function scheduleOf(draft: ScheduleDraft): SchedulePlanValue | undefined {
  const common = { startTime: draft.startTime, excludeHolidays: draft.excludeHolidays };
  if (draft.kind === 'one_off') return { kind: 'one_off', ...common, dates: [draft.date] };
  if (draft.kind === 'weekly') {
    return {
      kind: 'weekly',
      ...common,
      weekdays: WEEKDAY_ORDER.filter((day) => draft.weekdays.includes(day)),
      everyWeeks: parseInteger(draft.everyWeeks) ?? 1,
      startDate: draft.startDate,
      durationWeeks: parseInteger(draft.durationWeeks) ?? 1,
    };
  }
  if (draft.kind === 'monthly') {
    return {
      kind: 'monthly',
      ...common,
      monthDays: monthDaysOf(draft.monthDays) ?? [],
      startDate: draft.startDate,
      durationMonths: parseInteger(draft.durationMonths) ?? 1,
    };
  }
  return undefined;
}
