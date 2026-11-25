import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import type { AvailabilityRule, ExtraAvailability } from './agents-schemas';
import { availabilityTexts } from './agent-actions-texts';
import { type TimeSlot, WEEKDAYS, type Weekday } from './requests-schemas';

/**
 * Saisie des disponibilités d'un agent (partie 9.2) : semaine type en plages `HH:MM` à l'heure de
 * Porto-Novo, disponibilités exceptionnelles en date-heure. Mêmes contrôles que le service (R-DS-01) :
 * fin après début, aucune plage qui en chevauche une autre le même jour, 6 plages par jour au plus.
 */

export const MAX_RANGES = 6;
export const MAX_EXTRA = 50;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface RangeDraft {
  start: string;
  end: string;
}
export type WeekDraft = Record<Weekday, RangeDraft[]>;
export interface ExtraDraft {
  start: string;
  end: string;
}

/** Semaine type du contrat → saisie, un jour par entrée (un jour absent : aucune plage). */
export function toWeekDraft(weekly: readonly AvailabilityRule[]): WeekDraft {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      (weekly.find((rule) => rule.weekday === day)?.ranges ?? []).map((range) => ({ ...range })),
    ]),
  ) as WeekDraft;
}

/** Saisie → semaine type du contrat : jours avec au moins une plage, plages triées. */
export function toWeekly(draft: WeekDraft): AvailabilityRule[] {
  return WEEKDAYS.filter((day) => draft[day].length > 0).map((day) => ({
    weekday: day,
    ranges: [...draft[day]].sort((a, b) => a.start.localeCompare(b.start)).map((range) => ({ ...range })),
  }));
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Erreur d'un jour de la semaine type (`weekly.<jour>`) ; `null` s'il est bon. */
export function dayError(ranges: readonly RangeDraft[]): string | null {
  const t = availabilityTexts;
  if (ranges.length > MAX_RANGES) return t.maxRanges;
  for (const range of ranges) {
    if (!TIME.test(range.start) || !TIME.test(range.end) || minutes(range.end) <= minutes(range.start)) {
      return t.invalidRange;
    }
  }
  const sorted = [...ranges].sort((a, b) => minutes(a.start) - minutes(b.start));
  for (let index = 1; index < sorted.length; index += 1) {
    if (minutes(sorted[index - 1]!.end) > minutes(sorted[index]!.start)) return t.overlap;
  }
  return null;
}

/** Erreurs de la semaine type, par jour (`weekly.mon`…). */
export function weekErrors(draft: WeekDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const day of WEEKDAYS) {
    const error = dayError(draft[day]);
    if (error) errors[`weekly.${day}`] = error;
  }
  return errors;
}

/** Disponibilités exceptionnelles du contrat → saisie (`datetime-local`, heure du Bénin). */
export const toExtraDrafts = (extras: readonly ExtraAvailability[]): ExtraDraft[] =>
  extras.map((extra) => ({ start: isoToBeninInput(extra.start), end: isoToBeninInput(extra.end) }));

/** Période saisie (`datetime-local`, heure du Bénin) en créneau ISO, ou `null` si elle est invalide. */
export function toSlot(draft: ExtraDraft): TimeSlot | null {
  const start = beninInputToIso(draft.start);
  const end = beninInputToIso(draft.end);
  if (!start || !end || new Date(end).getTime() <= new Date(start).getTime()) return null;
  return { start, end };
}

/** Disponibilités exceptionnelles valides, ou l'index de la première invalide. */
export function toExtraSlots(drafts: readonly ExtraDraft[]): TimeSlot[] | { invalid: number } {
  const slots: TimeSlot[] = [];
  for (const [index, draft] of drafts.entries()) {
    const slot = toSlot(draft);
    if (!slot) return { invalid: index };
    slots.push(slot);
  }
  return slots;
}

/** Charge maximale saisie : entier entre `min` et `max`, ou `null`. */
export function hoursValue(raw: string, max: number): number | null {
  const value = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
  return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
}
