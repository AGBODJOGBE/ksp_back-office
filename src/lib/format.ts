/**
 * Formats d'affichage communs : montants en entiers de FCFA, dates à l'heure du Bénin
 * (Africa/Porto-Novo, UTC+1 toute l'année), quel que soit le fuseau du poste de l'agent.
 * Aucun calcul métier : on met en forme ce que la gateway renvoie.
 */

type Money = { amount: number; currency: string };

export const BENIN_TIME_ZONE = 'Africa/Porto-Novo';
/** Décalage du Bénin par rapport à UTC : pas d'heure d'été. */
const BENIN_OFFSET = '+01:00';

const xof = new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 });

/** Montant en entiers de FCFA (« 45 000 F CFA ») : jamais de décimales, jamais de division par 100. */
export function formatXof(value: Money | number): string {
  return xof.format(typeof value === 'number' ? value : value.amount);
}

const dateTime = new Intl.DateTimeFormat('fr-BJ', {
  timeZone: BENIN_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat('fr-BJ', {
  timeZone: BENIN_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const time = new Intl.DateTimeFormat('fr-BJ', {
  timeZone: BENIN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** « 5 nov. 2026, 09:00 », heure du Bénin. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** « jeu. 5 nov. 2026 ». */
export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

/** « jeu. 5 nov. 2026, 09:00 – 12:00 ». */
export function formatSlot(slot: { start: string; end: string }): string {
  return `${formatDate(slot.start)}, ${time.format(new Date(slot.start))} – ${time.format(new Date(slot.end))}`;
}

/** « 3 h », « 1 h 30 », « 45 min ». */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

/**
 * Valeur d'un champ `datetime-local` (heure du Bénin, `2026-11-05T09:00`) en ISO 8601 UTC, ou `null`
 * si elle est vide ou invalide.
 */
export function beninInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00${BENIN_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Inverse de `beninInputToIso` : valeur d'un champ `datetime-local` à l'heure du Bénin. */
export function isoToBeninInput(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3_600_000);
  return shifted.toISOString().slice(0, 16);
}
