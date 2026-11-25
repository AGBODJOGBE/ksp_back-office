'use client';

import { useCallback, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { beninInputToIso, isoToBeninInput } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import { completeVisit, type CompleteVisitBody } from '@/features/cleaning/requests-api';
import type { Visit } from '@/features/cleaning/requests-schemas';
import { visitTexts } from '@/features/cleaning/request-work-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { FieldGroup } from './editors';
import { MAX_REASON, reasonError, type StepProps, useKeyed } from './request-parts';
import {
  askedParameters,
  loadValueReferences,
  type ValueDraft,
  type ValueReferences,
  ValueFields,
  valueErrors,
  valuesOf,
} from './request-values';
import { type FieldErrors, FormFooter, ResourceView, useFormSubmit } from './parts';

const t = visitTexts.complete;
const c = cleaningTexts.common;
const FIELDS = ['reason', 'arrivedAt', 'completedAt', 'values'] as const;

function CompleteForm({
  request,
  visit,
  refs,
  onDone,
}: Pick<StepProps, 'request'> & { visit: Visit; refs: ValueReferences | null; onDone: () => void }) {
  const keyed = useKeyed();
  const form = useFormSubmit(FIELDS);
  const [reason, setReason] = useState('');
  const [arrivedAt, setArrivedAt] = useState('');
  const [completedAt, setCompletedAt] = useState(() => isoToBeninInput(new Date().toISOString()));
  const [draft, setDraft] = useState<ValueDraft>({});
  const parameters = refs
    ? askedParameters(
        refs,
        request.cleaningTypes.map((type) => type.id),
      )
    : [];
  const prefix = `cloture-${visit.id}`;

  function validate(): FieldErrors {
    const errors: FieldErrors = { ...valueErrors(draft, parameters) };
    const invalid = reasonError(reason);
    if (invalid) errors.reason = invalid;
    if (arrivedAt && !beninInputToIso(arrivedAt)) errors.arrivedAt = visitTexts.schedule.invalidWhen;
    const end = beninInputToIso(completedAt);
    if (!end) errors.completedAt = visitTexts.schedule.invalidWhen;
    else if (new Date(end).getTime() > Date.now()) errors.completedAt = t.future;
    return errors;
  }

  async function send() {
    const body: CompleteVisitBody = {
      reason: reason.trim(),
      completedAt: beninInputToIso(completedAt) as string,
      arrivedAt: beninInputToIso(arrivedAt) ?? undefined,
      values: refs ? valuesOf(draft, parameters) : undefined,
    };
    await keyed((key) => completeVisit(visit.id, body, key));
    onDone();
  }

  return (
    <form
      noValidate
      aria-label={t.title}
      onSubmit={(event) => void form.submit(event, validate(), send)}
      className="rounded-control bg-surface-muted grid gap-4 p-3 sm:p-4"
    >
      <h3 className="text-ink font-semibold">{t.title}</h3>
      <p className="text-small text-ink-muted">{t.lead}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${prefix}-arrivee`}
          type="datetime-local"
          label={t.arrivedAt}
          value={arrivedAt}
          error={form.errors.arrivedAt}
          onChange={(event) => setArrivedAt(event.target.value)}
        />
        <TextField
          id={`${prefix}-fin`}
          type="datetime-local"
          label={t.completedAt}
          value={completedAt}
          error={form.errors.completedAt}
          onChange={(event) => setCompletedAt(event.target.value)}
        />
      </div>
      {refs ? (
        <FieldGroup id={`${prefix}-constat`} legend={t.values} hint={t.valuesHint} error={form.errors.values}>
          <ValueFields
            idPrefix={`${prefix}-valeur`}
            parameters={parameters}
            draft={draft}
            errors={form.errors}
            onChange={(code, value) => setDraft((current) => ({ ...current, [code]: value }))}
          />
        </FieldGroup>
      ) : null}
      <TextAreaField
        id={`${prefix}-motif`}
        label={requestDetailTexts.reason}
        hint={c.tooLong(MAX_REASON)}
        maxLength={MAX_REASON}
        value={reason}
        error={form.errors.reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <FormFooter pending={form.pending} message={form.message} label={t.submit} />
    </form>
  );
}

/**
 * Clôture d'une visite au nom de l'agent (R-VI-08). Sans constat enregistré, le constat est saisi ici :
 * le catalogue du lieu est lu pour proposer ses paramètres.
 */
export function CompleteVisitForm({
  request,
  visit,
  onDone,
}: StepProps & { visit: Visit; onDone: () => void }) {
  const needsValues = visit.observedValues === null;
  const placeTypeId = request.place.placeTypeId;
  const refs = useResource(
    useCallback(
      () => (needsValues ? loadValueReferences(placeTypeId) : Promise.resolve(null)),
      [needsValues, placeTypeId],
    ),
  );
  return (
    <ResourceView resource={refs} lines={4}>
      {(loaded) => <CompleteForm request={request} visit={visit} refs={loaded} onDone={onDone} />}
    </ResourceView>
  );
}
