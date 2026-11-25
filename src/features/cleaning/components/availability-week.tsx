'use client';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { availabilityTexts } from '@/features/cleaning/agent-actions-texts';
import { weekdayName } from '@/features/cleaning/agents-texts';
import {
  type ExtraDraft,
  MAX_EXTRA,
  MAX_RANGES,
  type RangeDraft,
  type WeekDraft,
} from '@/features/cleaning/availability-edit';
import { WEEKDAYS, type Weekday } from '@/features/cleaning/requests-schemas';
import { FieldGroup } from './editors';
import { Note } from './parts';

const t = availabilityTexts;

/** Plage proposée à l'ajout : matinée, ou après la dernière plage du jour. */
function nextRange(ranges: readonly RangeDraft[]): RangeDraft {
  const last = ranges.at(-1);
  if (!last || last.end >= '22:00') return { start: '08:00', end: '12:00' };
  const hour = Number(last.end.slice(0, 2));
  return { start: last.end, end: `${String(Math.min(hour + 4, 23)).padStart(2, '0')}:00` };
}

function Day({
  day,
  ranges,
  error,
  disabled,
  onChange,
}: {
  day: Weekday;
  ranges: RangeDraft[];
  error?: string;
  disabled: boolean;
  onChange: (ranges: RangeDraft[]) => void;
}) {
  const name = weekdayName(day);
  const set = (index: number, change: Partial<RangeDraft>) =>
    onChange(ranges.map((range, rank) => (rank === index ? { ...range, ...change } : range)));
  return (
    <FieldGroup id={`dispo-${day}`} legend={name} error={error}>
      {ranges.length ? null : <Note>{t.dayOff}</Note>}
      {ranges.map((range, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <TextField
            id={`dispo-${day}-${index}-debut`}
            type="time"
            label={t.rangeStart}
            aria-label={t.rangeLabel(name, index + 1, t.rangeStart)}
            value={range.start}
            disabled={disabled}
            onChange={(event) => set(index, { start: event.target.value })}
          />
          <TextField
            id={`dispo-${day}-${index}-fin`}
            type="time"
            label={t.rangeEnd}
            aria-label={t.rangeLabel(name, index + 1, t.rangeEnd)}
            value={range.end}
            disabled={disabled}
            onChange={(event) => set(index, { end: event.target.value })}
          />
          {disabled ? null : (
            <Button
              variant="ghost"
              aria-label={t.removeRangeLabel(name, index + 1)}
              onClick={() => onChange(ranges.filter((_, rank) => rank !== index))}
            >
              {t.removeRange}
            </Button>
          )}
        </div>
      ))}
      {disabled || ranges.length >= MAX_RANGES ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          aria-label={`${t.addRange} : ${name.toLowerCase()}`}
          onClick={() => onChange([...ranges, nextRange(ranges)])}
        >
          {t.addRange}
        </Button>
      )}
    </FieldGroup>
  );
}

/** Semaine type : un groupe par jour, plages `HH:MM` à l'heure de Porto-Novo. */
export function WeekEditor({
  draft,
  errors,
  disabled = false,
  onChange,
}: {
  draft: WeekDraft;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (draft: WeekDraft) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {WEEKDAYS.map((day) => (
        <Day
          key={day}
          day={day}
          ranges={draft[day]}
          error={errors[`weekly.${day}`]}
          disabled={disabled}
          onChange={(ranges) => onChange({ ...draft, [day]: ranges })}
        />
      ))}
    </div>
  );
}

/** Disponibilités exceptionnelles : périodes en date-heure (heure du Bénin), 50 au plus. */
export function ExtraEditor({
  drafts,
  invalid,
  disabled = false,
  onChange,
}: {
  drafts: ExtraDraft[];
  /** Rang de la période refusée par le contrôle local. */
  invalid: number | null;
  disabled?: boolean;
  onChange: (drafts: ExtraDraft[]) => void;
}) {
  const set = (index: number, change: Partial<ExtraDraft>) =>
    onChange(drafts.map((draft, rank) => (rank === index ? { ...draft, ...change } : draft)));
  return (
    <FieldGroup id="dispo-exceptions" legend={t.extra} hint={t.extraHint}>
      {drafts.length ? null : <Note>{t.extraNone}</Note>}
      {drafts.map((draft, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <TextField
            id={`dispo-exception-${index}-debut`}
            type="datetime-local"
            label={t.extraStart}
            value={draft.start}
            disabled={disabled}
            error={invalid === index ? t.extraInvalid : undefined}
            onChange={(event) => set(index, { start: event.target.value })}
          />
          <TextField
            id={`dispo-exception-${index}-fin`}
            type="datetime-local"
            label={t.extraEnd}
            value={draft.end}
            disabled={disabled}
            onChange={(event) => set(index, { end: event.target.value })}
          />
          {disabled ? null : (
            <Button
              variant="ghost"
              aria-label={t.extraRemoveLabel(`${draft.start.replace('T', ' ')}`)}
              onClick={() => onChange(drafts.filter((_, rank) => rank !== index))}
            >
              {t.extraRemove}
            </Button>
          )}
        </div>
      ))}
      {disabled || drafts.length >= MAX_EXTRA ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...drafts, { start: '', end: '' }])}
        >
          {t.extraAdd}
        </Button>
      )}
    </FieldGroup>
  );
}
