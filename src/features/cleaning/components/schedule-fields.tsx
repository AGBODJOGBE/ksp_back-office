'use client';

import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import type { ScheduleDraft, ScheduleKind } from '@/features/cleaning/schedule-plan';
import { simulatorTexts } from '@/features/cleaning/simulator-texts';
import { CheckField, FieldGroup } from './editors';
import type { FieldErrors } from './parts';

const t = simulatorTexts;
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Saisie d'un plan de séances (date unique, semaine, jours du mois), pour le changement d'horaire et
 * l'avenant. Erreurs lues aux clés `<prefix>.<champ>` (chemins du contrat).
 */
export function ScheduleFields({
  idPrefix,
  prefix,
  legend,
  hint,
  noneLabel,
  draft,
  errors,
  change,
}: {
  idPrefix: string;
  prefix: string;
  legend: string;
  hint?: string;
  /** Libellé du choix « aucun plan » ; absent, le choix n'est pas proposé. */
  noneLabel?: string;
  draft: ScheduleDraft;
  errors: FieldErrors;
  change: (patch: Partial<ScheduleDraft>) => void;
}) {
  const kinds: ScheduleKind[] = noneLabel
    ? ['none', 'one_off', 'weekly', 'monthly']
    : ['one_off', 'weekly', 'monthly'];
  const error = (field: string) => errors[`${prefix}.${field}`];
  return (
    <FieldGroup id={idPrefix} legend={legend} hint={hint} error={errors[prefix]}>
      <SelectField
        id={`${idPrefix}-type`}
        label={t.schedule}
        value={draft.kind}
        onChange={(event) => change({ kind: event.target.value as ScheduleKind })}
        className="max-w-md"
      >
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {kind === 'none' ? noneLabel : t.scheduleKinds[kind]}
          </option>
        ))}
      </SelectField>
      {draft.kind === 'none' ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.kind === 'one_off' ? (
            <TextField
              id={`${idPrefix}-date`}
              type="date"
              label={t.date}
              value={draft.date}
              error={error('dates')}
              onChange={(event) => change({ date: event.target.value })}
            />
          ) : (
            <TextField
              id={`${idPrefix}-debut`}
              type="date"
              label={t.startDate}
              value={draft.startDate}
              error={error('startDate')}
              onChange={(event) => change({ startDate: event.target.value })}
            />
          )}
          <TextField
            id={`${idPrefix}-heure`}
            type="time"
            label={t.startTime}
            value={draft.startTime}
            error={error('startTime')}
            onChange={(event) => change({ startTime: event.target.value })}
          />
          {draft.kind === 'weekly' ? (
            <>
              <FieldGroup id={`${idPrefix}-jours`} legend={t.weekdays} error={error('weekdays')}>
                <div className="grid grid-cols-2 gap-1">
                  {WEEKDAYS.map((weekday) => (
                    <CheckField
                      key={weekday}
                      id={`${idPrefix}-jour-${weekday}`}
                      label={t.weekdayNames[weekday]}
                      checked={draft.weekdays.includes(weekday)}
                      onChange={(checked) =>
                        change({
                          weekdays: checked
                            ? WEEKDAYS.filter((item) => item === weekday || draft.weekdays.includes(item))
                            : draft.weekdays.filter((item) => item !== weekday),
                        })
                      }
                    />
                  ))}
                </div>
              </FieldGroup>
              <div className="grid content-start gap-4">
                <TextField
                  id={`${idPrefix}-semaines`}
                  label={t.everyWeeks}
                  inputMode="numeric"
                  value={draft.everyWeeks}
                  error={error('everyWeeks')}
                  onChange={(event) => change({ everyWeeks: event.target.value })}
                />
                <TextField
                  id={`${idPrefix}-duree-semaines`}
                  label={t.durationWeeks}
                  inputMode="numeric"
                  value={draft.durationWeeks}
                  error={error('durationWeeks')}
                  onChange={(event) => change({ durationWeeks: event.target.value })}
                />
              </div>
            </>
          ) : null}
          {draft.kind === 'monthly' ? (
            <>
              <TextField
                id={`${idPrefix}-jours-mois`}
                label={t.monthDays}
                hint={t.monthDaysHint}
                value={draft.monthDays}
                error={error('monthDays')}
                onChange={(event) => change({ monthDays: event.target.value })}
              />
              <TextField
                id={`${idPrefix}-duree-mois`}
                label={t.durationMonths}
                inputMode="numeric"
                value={draft.durationMonths}
                error={error('durationMonths')}
                onChange={(event) => change({ durationMonths: event.target.value })}
              />
            </>
          ) : null}
          <CheckField
            id={`${idPrefix}-feries`}
            label={t.excludeHolidays}
            checked={draft.excludeHolidays}
            onChange={(excludeHolidays) => change({ excludeHolidays })}
          />
        </div>
      )}
    </FieldGroup>
  );
}
