'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { beninDay } from '@/lib/format';
import { parseInteger } from '@/features/cleaning/inputs';
import { programChangeTexts } from '@/features/cleaning/program-detail-texts';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import { changeProgramSchedule } from '@/features/cleaning/programs-api';
import {
  type ScheduleDraft,
  scheduleDraftOf,
  scheduleErrors,
  scheduleOf,
} from '@/features/cleaning/schedule-plan';
import { cleaningTexts } from '@/features/cleaning/texts';
import type { ProgramProps } from './program-detail';
import { MAX_REASON, reasonError, useKeyed } from './request-parts';
import { type FieldErrors, FormFooter, Panel, useFormSubmit } from './parts';
import { ScheduleFields } from './schedule-fields';

const t = programChangeTexts.schedule;
const c = cleaningTexts.common;
const FIELDS = ['effectiveFrom', 'schedule', 'reason', 'durationMinutes'] as const;

/**
 * Changer le jour ou l'heure des séances à venir (R-PG-06) : même nombre de séances, sinon la gateway
 * demande un avenant (`CLEANING_AMENDMENT_REQUIRED`). Plan prérempli avec le plan actuel.
 */
export function ScheduleChangeForm({
  program,
  onChange,
  onClose,
}: ProgramProps & { onClose: (message?: string) => void }) {
  const keyed = useKeyed();
  const form = useFormSubmit(FIELDS);
  const [effectiveFrom, setEffectiveFrom] = useState(() => beninDay(new Date()));
  const [draft, setDraft] = useState<ScheduleDraft>(() => scheduleDraftOf(program.schedule));
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');
  const change = (patch: Partial<ScheduleDraft>) => setDraft((previous) => ({ ...previous, ...patch }));

  function validate(): FieldErrors {
    const errors: FieldErrors = scheduleErrors(draft, 'schedule', c.required);
    if (!effectiveFrom) errors.effectiveFrom = c.required;
    const raw = duration.trim();
    const minutes = raw ? parseInteger(raw) : undefined;
    if (minutes === null || (minutes !== undefined && (minutes < 15 || minutes > 1440))) {
      errors.durationMinutes = c.between(15, 1440);
    }
    const invalid = reasonError(reason.trim());
    if (invalid) errors.reason = invalid;
    return errors;
  }

  return (
    <Panel title={t.title} id="programme-horaire">
      <p className="text-ink-muted max-w-reading">{t.lead}</p>
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) =>
          form.submit(event, validate(), async () => {
            const schedule = scheduleOf(draft);
            if (!schedule) return;
            const raw = duration.trim();
            const next = await keyed((key) =>
              changeProgramSchedule(
                program.id,
                {
                  effectiveFrom,
                  schedule,
                  reason: reason.trim(),
                  ...(raw ? { durationMinutes: parseInteger(raw) ?? 0 } : {}),
                },
                key,
              ),
            );
            onChange(next);
            onClose(t.done);
          })
        }
      >
        <TextField
          id="horaire-a-partir"
          type="date"
          label={t.effectiveFrom}
          value={effectiveFrom}
          error={form.errors.effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          className="max-w-xs"
        />
        <ScheduleFields
          idPrefix="horaire-plan"
          prefix="schedule"
          legend={t.plan}
          hint={t.planHint}
          draft={draft}
          errors={form.errors}
          change={change}
        />
        <TextField
          id="horaire-duree"
          label={t.duration}
          hint={t.durationHint}
          inputMode="numeric"
          value={duration}
          error={form.errors.durationMinutes}
          onChange={(event) => setDuration(event.target.value)}
          className="max-w-xs"
        />
        <TextAreaField
          id="horaire-motif"
          label={requestDetailTexts.reason}
          hint={requestDetailTexts.reasonHint}
          maxLength={MAX_REASON}
          required
          value={reason}
          error={form.errors.reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="flex flex-wrap items-end gap-3">
          <FormFooter
            pending={form.pending}
            message={form.message}
            label={t.submit}
            pendingLabel={c.sending}
          />
          <Button variant="ghost" onClick={() => onClose()}>
            {c.cancel}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
