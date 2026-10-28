'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { type QuoteInput, sendQuote } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { requestTexts } from '@/features/cleaning/request-texts';
import type { QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';

const t = requestTexts.sendQuote;
const common = cleaningTexts.common;

type Line = { label: string; quantity: string; unitPrice: string };
type Slot = { start: string; end: string };

const LEGEND = 'text-ink font-semibold';
const GROUP = 'rounded-card border-line grid gap-4 border p-3 sm:p-4';

/** Entier saisi, ou `undefined` si le champ est vide ; `NaN` s'il n'est pas un entier. */
function integer(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function minutesBetween(slot: { start: string; end: string } | undefined): string {
  if (!slot) return '';
  const minutes = (Date.parse(slot.end) - Date.parse(slot.start)) / 60_000;
  return minutes > 0 ? String(minutes) : '';
}

/**
 * Devis d'une demande (UC-CL-08). Sans ligne saisie, la gateway préremplit depuis la grille en vigueur
 * et calcule les montants : le front n'en calcule aucun. Les créneaux souhaités par le client servent
 * de point de départ, modifiables.
 */
export function QuoteForm({
  request,
  onSent,
  onCancel,
}: {
  request: QuoteRequest;
  onSent: (request: QuoteRequest) => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [slots, setSlots] = useState<Slot[]>(() =>
    (request.preferredSlots.length ? request.preferredSlots.slice(0, 3) : [{ start: '', end: '' }]).map(
      (slot) => ({
        start: slot.start ? isoToBeninInput(slot.start) : '',
        end: slot.end ? isoToBeninInput(slot.end) : '',
      }),
    ),
  );
  const [recurring, setRecurring] = useState(!!request.recurrence);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((all) => all.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const updateSlot = (index: number, patch: Partial<Slot>) =>
    setSlots((all) => all.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const read = (name: string) => integer(String(data.get(name) ?? ''));

    const proposedSlots = slots.map((slot) => ({
      start: beninInputToIso(slot.start),
      end: beninInputToIso(slot.end),
    }));
    if (proposedSlots.some((slot) => !slot.start || !slot.end)) return setError(t.slotsInvalid);
    const durationMinutes = read('duration');
    const teamSize = read('team');
    const validityDays = read('validity');
    const parsedLines = lines.map((line) => ({
      label: line.label.trim(),
      quantity: integer(line.quantity),
      unitPrice: integer(line.unitPrice),
    }));
    const numbers = [
      durationMinutes,
      teamSize,
      validityDays,
      ...parsedLines.flatMap((l) => [l.quantity, l.unitPrice]),
    ];
    if (durationMinutes === undefined || numbers.some((value) => Number.isNaN(value))) {
      return setError(common.invalidNumber);
    }
    if (
      parsedLines.some((line) => !line.label || line.quantity === undefined || line.unitPrice === undefined)
    ) {
      return setError(common.required);
    }

    const input: QuoteInput = {
      proposedSlots: proposedSlots as QuoteInput['proposedSlots'],
      durationMinutes,
      ...(parsedLines.length
        ? { lines: parsedLines as Array<{ label: string; quantity: number; unitPrice: number }> }
        : {}),
      ...(teamSize !== undefined ? { teamSize } : {}),
      ...(validityDays !== undefined ? { validityDays } : {}),
    };
    if (recurring) {
      const visitsPerPeriod = read('visits');
      const durationMonths = read('months');
      if (
        visitsPerPeriod === undefined ||
        durationMonths === undefined ||
        Number.isNaN(visitsPerPeriod + durationMonths)
      ) {
        return setError(common.invalidNumber);
      }
      input.recurrence = { period: String(data.get('period')), visitsPerPeriod, durationMonths };
    }

    setPending(true);
    setError(null);
    try {
      onSent(await sendQuote(request.id, input));
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="devis-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <div>
        <h3 id="devis-titre" className="font-display text-h3 text-ink font-semibold">
          {t.title}
        </h3>
        <p className="text-small text-ink-muted mt-1">{t.text}</p>
      </div>

      <fieldset className={GROUP}>
        <legend className={LEGEND}>{t.gridLines}</legend>
        <p className="text-small text-ink-muted">{t.gridHint}</p>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-end">
            <TextField
              id={`ligne-${index}-libelle`}
              label={t.lineLabel}
              value={line.label}
              maxLength={200}
              onChange={(event) => updateLine(index, { label: event.target.value })}
            />
            <TextField
              id={`ligne-${index}-quantite`}
              label={t.lineQuantity}
              inputMode="numeric"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <TextField
              id={`ligne-${index}-prix`}
              label={t.lineUnitPrice}
              inputMode="numeric"
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
            />
            <Button variant="ghost" onClick={() => setLines((all) => all.filter((_, i) => i !== index))}>
              {t.removeLine(index + 1)}
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => setLines((all) => [...all, { label: '', quantity: '1', unitPrice: '' }])}
        >
          {t.addLine}
        </Button>
      </fieldset>

      <fieldset className={GROUP}>
        <legend className={LEGEND}>{t.slots}</legend>
        <p className="text-small text-ink-muted">{common.beninTime}</p>
        {slots.map((slot, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField
              id={`creneau-${index}-debut`}
              type="datetime-local"
              label={t.slotStart(index + 1)}
              value={slot.start}
              onChange={(event) => updateSlot(index, { start: event.target.value })}
            />
            <TextField
              id={`creneau-${index}-fin`}
              type="datetime-local"
              label={t.slotEnd(index + 1)}
              value={slot.end}
              onChange={(event) => updateSlot(index, { end: event.target.value })}
            />
            {slots.length > 1 ? (
              <Button variant="ghost" onClick={() => setSlots((all) => all.filter((_, i) => i !== index))}>
                {t.removeSlot(index + 1)}
              </Button>
            ) : null}
          </div>
        ))}
        {slots.length < 3 ? (
          <Button
            variant="secondary"
            className="justify-self-start"
            onClick={() => setSlots((all) => [...all, { start: '', end: '' }])}
          >
            {t.addSlot}
          </Button>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="devis-duree"
          name="duration"
          label={t.duration}
          inputMode="numeric"
          required
          defaultValue={minutesBetween(request.preferredSlots[0])}
        />
        <TextField
          id="devis-agents"
          name="team"
          label={t.teamSize}
          hint={t.teamSizeHint(request.recommendedTeamSize)}
          inputMode="numeric"
          defaultValue={String(request.requestedTeamSize ?? request.recommendedTeamSize)}
        />
        <TextField
          id="devis-validite"
          name="validity"
          label={t.validity}
          hint={t.validityHint}
          inputMode="numeric"
        />
      </div>

      <fieldset className={GROUP}>
        <legend className={LEGEND}>{t.recurrence}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
            className="accent-brand size-5"
          />
          {t.recurrenceToggle}
        </label>
        {recurring ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              id="devis-periode"
              name="period"
              label={t.period}
              defaultValue={request.recurrence?.period ?? 'week'}
            >
              <option value="week">{t.week}</option>
              <option value="month">{t.month}</option>
            </SelectField>
            <TextField
              id="devis-passages"
              name="visits"
              label={t.visitsPerPeriod}
              inputMode="numeric"
              defaultValue={request.recurrence ? String(request.recurrence.visitsPerPeriod) : ''}
            />
            <TextField
              id="devis-mois"
              name="months"
              label={t.durationMonths}
              inputMode="numeric"
              defaultValue={request.recurrence ? String(request.recurrence.durationMonths) : ''}
            />
          </div>
        ) : null}
      </fieldset>

      <FormMessage>{error}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-busy={pending || undefined} disabled={pending}>
          {pending ? common.sending : t.confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
