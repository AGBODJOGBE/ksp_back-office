'use client';

import { type FormEvent, useRef, useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { availabilityTexts } from '@/features/cleaning/agent-actions-texts';
import { type AvailabilityBody, setAvailability } from '@/features/cleaning/agents-api';
import type { Availability } from '@/features/cleaning/agents-schemas';
import {
  type ExtraDraft,
  hoursValue,
  toExtraDrafts,
  toExtraSlots,
  toWeekDraft,
  toWeekly,
  type WeekDraft,
  weekErrors,
} from '@/features/cleaning/availability-edit';
import { attempt, errorCode, errorText } from '@/features/cleaning/errors';
import { cleaningTexts } from '@/features/cleaning/texts';
import { ExtraEditor, WeekEditor } from './availability-week';
import { FormFooter } from './parts';
import { confirmLabels } from './request-parts';

const t = availabilityTexts;
const c = cleaningTexts.common;

/** Champ qui reçoit le focus après un contrôle local : premier jour en cause, puis exception, puis charge. */
function firstInvalid(errors: Record<string, string>, extra: number | null): string {
  const day = Object.keys(errors).find((key) => key.startsWith('weekly.'));
  if (day) return `dispo-${day.slice('weekly.'.length)}-0-debut`;
  if (extra !== null) return `dispo-exception-${extra}-debut`;
  return errors.maxHoursPerDay ? 'dispo-heures-jour' : 'dispo-heures-semaine';
}

/**
 * Disponibilités d'un agent (`PUT /agents/{id}/availability`) : semaine type, disponibilités
 * exceptionnelles et charge maximale, envoyées ensemble (elles remplacent les précédentes). Retirer une
 * plage déjà occupée est refusé (`CLEANING_AVAILABILITY_IN_USE`) : l'écran propose alors de forcer, ce
 * qui retire et replanifie les affectations touchées.
 */
export function AvailabilityForm({
  agentId,
  availability,
  onSaved,
}: {
  agentId: string;
  availability: Availability;
  onSaved: (availability: Availability) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [week, setWeek] = useState<WeekDraft>(() => toWeekDraft(availability.weekly));
  const [extras, setExtras] = useState<ExtraDraft[]>(() => toExtraDrafts(availability.extraAvailabilities));
  const [perDay, setPerDay] = useState(String(availability.maxHoursPerDay));
  const [perWeek, setPerWeek] = useState(String(availability.maxHoursPerWeek));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invalidExtra, setInvalidExtra] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [inUse, setInUse] = useState<AvailabilityBody | null>(null);

  /** Corps prêt à l'envoi, ou `null` après avoir signalé les erreurs locales. */
  function body(): AvailabilityBody | null {
    const found = weekErrors(week);
    const day = hoursValue(perDay, 24);
    const weekHours = hoursValue(perWeek, 168);
    if (day === null) found.maxHoursPerDay = c.between(1, 24);
    if (weekHours === null) found.maxHoursPerWeek = c.between(1, 168);
    const slots = toExtraSlots(extras);
    const badExtra = 'invalid' in slots ? slots.invalid : null;
    setErrors(found);
    setInvalidExtra(badExtra);
    if (Object.keys(found).length || badExtra !== null || day === null || weekHours === null) {
      setMessage(c.fixErrors);
      const target = firstInvalid(found, badExtra);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${target}`)?.focus());
      return null;
    }
    return {
      weekly: toWeekly(week),
      extraAvailabilities: 'invalid' in slots ? [] : slots,
      maxHoursPerDay: day,
      maxHoursPerWeek: weekHours,
    };
  }

  async function send(payload: AvailabilityBody) {
    const saved = await setAvailability(agentId, payload);
    onSaved(saved);
    setInUse(null);
    setSuccess(t.saved);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSuccess(null);
    setInUse(null);
    const payload = body();
    if (!payload) return;
    setPending(true);
    setMessage(null);
    try {
      await send(payload);
    } catch (error) {
      if (errorCode(error) === 'CLEANING_AVAILABILITY_IN_USE') setInUse(payload);
      setMessage(errorCode(error) === 'CLEANING_AVAILABILITY_IN_USE' ? t.inUse : errorText(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="grid gap-6">
      <p className="text-small text-ink-muted max-w-reading">{t.hint}</p>
      <section aria-labelledby="dispo-semaine" className="grid gap-4">
        <h3 id="dispo-semaine" className="text-ink font-semibold">
          {t.weekly}
        </h3>
        <WeekEditor draft={week} errors={errors} onChange={setWeek} />
      </section>
      <ExtraEditor drafts={extras} invalid={invalidExtra} onChange={setExtras} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="dispo-heures-jour"
          label={t.maxPerDay}
          inputMode="numeric"
          value={perDay}
          error={errors.maxHoursPerDay}
          onChange={(event) => setPerDay(event.target.value)}
        />
        <TextField
          id="dispo-heures-semaine"
          label={t.maxPerWeek}
          inputMode="numeric"
          value={perWeek}
          error={errors.maxHoursPerWeek}
          onChange={(event) => setPerWeek(event.target.value)}
        />
      </div>
      <FormFooter pending={pending} message={message} success={success} label={t.save} />
      {inUse ? (
        <ConfirmAction
          label={t.force}
          title={t.force}
          description={t.inUse}
          confirmLabel={t.force}
          labels={confirmLabels}
          danger
          className="justify-self-start"
          onConfirm={() =>
            attempt(async () => {
              await send({ ...inUse, force: true });
              setMessage(null);
            })
          }
        />
      ) : null}
    </form>
  );
}
