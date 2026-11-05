'use client';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { beninInputToIso, formatDuration, formatSlot, formatXof, isoToBeninInput } from '@/lib/format';
import type { QuoteInput } from '@/features/cleaning/api';
import { quoteTexts as t } from '@/features/cleaning/quote-texts';
import type { QuoteRequest, TimeSlot } from '@/features/cleaning/schemas';
import { cleaningTexts, recurrenceText } from '@/features/cleaning/texts';

/*
 * Briques communes au devis d'une demande et aux devis groupés : saisie des lignes, des créneaux, de la
 * durée, des agents et de la récurrence, lecture selon le contrat (`SendCleaningQuoteRequest`,
 * `SendCleaningGroupQuotesRequest`), estimation du serveur et récapitulatif. Aucun montant n'est calculé ici.
 */

const common = cleaningTexts.common;

export const LEGEND = 'text-ink font-semibold';
export const GROUP = 'rounded-card border-line grid gap-4 border p-3 sm:p-4';

export type Line = { label: string; quantity: string; unitPrice: string };
export type Slot = { start: string; end: string };

/** Saisie du devis d'une demande (tout en texte, lu à l'envoi). */
export interface Draft {
  lines: Line[];
  duration: string;
  team: string;
  recurring: boolean;
  period: string;
  visits: string;
  months: string;
}

/** Entier saisi, ou `undefined` si le champ est vide ; `NaN` s'il n'est pas un entier. */
export function integer(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

const within = (value: number | undefined, min: number, max: number) =>
  value === undefined || (!Number.isNaN(value) && value >= min && value <= max);

function minutesBetween(slot: TimeSlot | undefined): string {
  if (!slot) return '';
  const minutes = (Date.parse(slot.end) - Date.parse(slot.start)) / 60_000;
  return minutes > 0 ? String(minutes) : '';
}

/** Point de départ : créneaux souhaités par le client, agents demandés (sinon recommandés), sa récurrence. */
export function initialDraft(request: QuoteRequest): Draft {
  return {
    lines: [],
    duration: minutesBetween(request.preferredSlots[0]),
    team: String(request.requestedTeamSize ?? request.recommendedTeamSize),
    recurring: !!request.recurrence,
    period: request.recurrence?.period ?? 'week',
    visits: request.recurrence ? String(request.recurrence.visitsPerPeriod) : '',
    months: request.recurrence ? String(request.recurrence.durationMonths) : '',
  };
}

export function initialSlots(request: QuoteRequest | undefined): Slot[] {
  const preferred = request?.preferredSlots.slice(0, 3) ?? [];
  return (preferred.length ? preferred : [{ start: '', end: '' }]).map((slot) => ({
    start: slot.start ? isoToBeninInput(slot.start) : '',
    end: slot.end ? isoToBeninInput(slot.end) : '',
  }));
}

/** Créneaux en ISO 8601, ou `null` si l'un d'eux n'a pas de début ou de fin valides. */
export function readSlots(slots: readonly Slot[]): TimeSlot[] | null {
  const read = slots.map((slot) => ({ start: beninInputToIso(slot.start), end: beninInputToIso(slot.end) }));
  return read.every((slot) => slot.start && slot.end) ? (read as TimeSlot[]) : null;
}

/** Validité de 1 à 90 jours, facultative. */
export function readValidity(value: string): { ok: true; days?: number } | { ok: false } {
  const days = integer(value);
  return within(days, 1, 90) ? { ok: true, days } : { ok: false };
}

export type QuotePart = Pick<QuoteInput, 'lines' | 'recurrence' | 'teamSize' | 'durationMinutes'>;

/** Lit la saisie d'un devis selon les bornes du contrat ; le premier défaut donne le message. */
export function readDraft(draft: Draft): { ok: true; value: QuotePart } | { ok: false; message: string } {
  const durationMinutes = integer(draft.duration);
  const teamSize = integer(draft.team);
  if (durationMinutes === undefined || !within(durationMinutes, 1, 1440) || !within(teamSize, 1, 50)) {
    return { ok: false, message: common.invalidNumber };
  }
  const lines = draft.lines.map((line) => ({
    label: line.label.trim(),
    quantity: integer(line.quantity),
    unitPrice: integer(line.unitPrice),
  }));
  if (lines.some((line) => !line.label || line.quantity === undefined || line.unitPrice === undefined)) {
    return { ok: false, message: common.required };
  }
  if (lines.some((line) => !within(line.quantity, 1, 1_000_000) || Number.isNaN(line.unitPrice))) {
    return { ok: false, message: common.invalidNumber };
  }
  const value: QuotePart = {
    durationMinutes,
    ...(lines.length ? { lines: lines as NonNullable<QuotePart['lines']> } : {}),
    ...(teamSize !== undefined ? { teamSize } : {}),
  };
  if (draft.recurring) {
    const visitsPerPeriod = integer(draft.visits);
    const durationMonths = integer(draft.months);
    if (
      visitsPerPeriod === undefined ||
      durationMonths === undefined ||
      !within(visitsPerPeriod, 1, 31) ||
      !within(durationMonths, 1, 36)
    ) {
      return { ok: false, message: common.invalidNumber };
    }
    value.recurrence = { period: draft.period, visitsPerPeriod, durationMonths };
  }
  return { ok: true, value };
}

export function SlotsEditor({
  slots,
  onChange,
  legend,
  idPrefix,
}: {
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
  legend: string;
  idPrefix: string;
}) {
  const update = (index: number, patch: Partial<Slot>) =>
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  return (
    <fieldset className={GROUP}>
      <legend className={LEGEND}>{legend}</legend>
      <p className="text-small text-ink-muted">{common.beninTime}</p>
      {slots.map((slot, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField
            id={`${idPrefix}-creneau-${index}-debut`}
            type="datetime-local"
            label={t.slotStart(index + 1)}
            value={slot.start}
            onChange={(event) => update(index, { start: event.target.value })}
          />
          <TextField
            id={`${idPrefix}-creneau-${index}-fin`}
            type="datetime-local"
            label={t.slotEnd(index + 1)}
            value={slot.end}
            onChange={(event) => update(index, { end: event.target.value })}
          />
          {slots.length > 1 ? (
            <Button variant="ghost" onClick={() => onChange(slots.filter((_, i) => i !== index))}>
              {t.removeSlot(index + 1)}
            </Button>
          ) : null}
        </div>
      ))}
      {slots.length < 3 ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...slots, { start: '', end: '' }])}
        >
          {t.addSlot}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Lignes, durée, agents et récurrence d'un devis. */
export function DraftEditor({
  draft,
  onChange,
  idPrefix,
  recommendedTeamSize,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  idPrefix: string;
  recommendedTeamSize: number;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const updateLine = (index: number, patch: Partial<Line>) =>
    set({ lines: draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  return (
    <>
      <fieldset className={GROUP}>
        <legend className={LEGEND}>{t.gridLines}</legend>
        <p className="text-small text-ink-muted">{t.gridHint}</p>
        {draft.lines.map((line, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-end">
            <TextField
              id={`${idPrefix}-ligne-${index}-libelle`}
              label={t.lineLabel}
              value={line.label}
              maxLength={200}
              onChange={(event) => updateLine(index, { label: event.target.value })}
            />
            <TextField
              id={`${idPrefix}-ligne-${index}-quantite`}
              label={t.lineQuantity}
              inputMode="numeric"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <TextField
              id={`${idPrefix}-ligne-${index}-prix`}
              label={t.lineUnitPrice}
              inputMode="numeric"
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
            />
            <Button variant="ghost" onClick={() => set({ lines: draft.lines.filter((_, i) => i !== index) })}>
              {t.removeLine(index + 1)}
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => set({ lines: [...draft.lines, { label: '', quantity: '1', unitPrice: '' }] })}
        >
          {t.addLine}
        </Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-duree`}
          label={t.duration}
          inputMode="numeric"
          required
          value={draft.duration}
          onChange={(event) => set({ duration: event.target.value })}
        />
        <TextField
          id={`${idPrefix}-agents`}
          label={t.teamSize}
          hint={t.teamSizeHint(recommendedTeamSize)}
          inputMode="numeric"
          value={draft.team}
          onChange={(event) => set({ team: event.target.value })}
        />
      </div>

      <fieldset className={GROUP}>
        <legend className={LEGEND}>{t.recurrence}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={draft.recurring}
            onChange={(event) => set({ recurring: event.target.checked })}
            className="accent-brand size-5"
          />
          {t.recurrenceToggle}
        </label>
        {draft.recurring ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              id={`${idPrefix}-periode`}
              label={t.period}
              value={draft.period}
              onChange={(event) => set({ period: event.target.value })}
            >
              <option value="week">{t.week}</option>
              <option value="month">{t.month}</option>
            </SelectField>
            <TextField
              id={`${idPrefix}-passages`}
              label={t.visitsPerPeriod}
              inputMode="numeric"
              value={draft.visits}
              onChange={(event) => set({ visits: event.target.value })}
            />
            <TextField
              id={`${idPrefix}-mois`}
              label={t.durationMonths}
              inputMode="numeric"
              value={draft.months}
              onChange={(event) => set({ months: event.target.value })}
            />
          </div>
        ) : null}
      </fieldset>
    </>
  );
}

/**
 * Estimation déjà calculée par le serveur sur la demande (`calculation`, sinon l'ancienne fourchette
 * `estimate`), avec la mention qu'elle n'est pas le prix définitif. Aucun calcul dans le front.
 */
export function EstimateNote({ request }: { request: QuoteRequest }) {
  const calculation = request.calculation;
  const price = calculation?.priced ? calculation.computedPrice : null;
  const range = calculation ? calculation.estimate : request.estimate;
  return (
    <div className="rounded-control border-line bg-surface grid gap-1 border p-3">
      <p className="text-ink font-semibold">{t.estimate.title}</p>
      {price || range ? (
        <>
          {price ? <p className="tabular-nums">{t.estimate.price(formatXof(price))}</p> : null}
          {range ? (
            <p className="text-ink-muted tabular-nums">
              {t.estimate.range(formatXof(range.low), formatXof(range.high))}
            </p>
          ) : null}
          <p className="text-small text-ink-muted">{t.estimate.notice}</p>
        </>
      ) : (
        <p className="text-small text-ink-muted">{t.estimate.none}</p>
      )}
    </div>
  );
}

/** Récapitulatif d'un devis avant l'envoi : ce qui part au client, sans montant calculé par le front. */
export function QuoteRecap({ service, part }: { service?: string; part: QuotePart }) {
  const s = t.send;
  const rows: Array<[string, string]> = [
    ...(service ? ([[s.service, service]] as Array<[string, string]>) : []),
    [s.duration, formatDuration(part.durationMinutes)],
    [s.teamSize, part.teamSize !== undefined ? String(part.teamSize) : s.none],
    [s.lines, part.lines?.length ? s.customLines(part.lines.length) : s.prefilled],
    [s.recurrence, part.recurrence ? recurrenceText(part.recurrence) : s.none],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(8rem,max-content)_1fr]">
      {rows.map(([term, value]) => (
        <div key={term} className="grid sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-small text-ink-muted">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Créneaux et validité communs, dans le récapitulatif. */
export function SlotsRecap({ slots, validityDays }: { slots: TimeSlot[]; validityDays?: number }) {
  const s = t.send;
  return (
    <div className="grid gap-2">
      <p className="text-small text-ink-muted">{s.slots}</p>
      <ul className="grid gap-1">
        {slots.map((slot) => (
          <li key={slot.start}>{formatSlot(slot)}</li>
        ))}
      </ul>
      <p className="text-small text-ink-muted">
        {s.validity} : {validityDays !== undefined ? s.validityDays(validityDays) : s.validityDefault}
      </p>
    </div>
  );
}
