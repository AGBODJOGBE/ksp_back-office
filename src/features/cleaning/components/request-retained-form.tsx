'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormMessage } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import type { Values } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { latestObserved } from '@/features/cleaning/request-steps';
import { estimateRetainedValues, saveRetainedValues } from '@/features/cleaning/requests-api';
import type { ValueReason } from '@/features/cleaning/requests-schemas';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import type { Pricing } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { FieldGroup, OrderedPicker } from './editors';
import { MAX_REASON, type StepProps } from './request-parts';
import { PricingSummary } from './request-pricing';
import {
  askedParameters,
  draftOf,
  loadValueReferences,
  type ValueDraft,
  type ValueReferences,
  ValueFields,
  valueErrors,
  valuesOf,
} from './request-values';
import { type FieldErrors, FormFooter, ResourceView, useFormSubmit } from './parts';

const t = retainedTexts;
const c = cleaningTexts.common;
const FIELDS = ['values', 'cleaningTypeIds', 'reasons', 'reason'] as const;
/** Pause de saisie avant de relancer l'estimation. */
export const ESTIMATE_DELAY_MS = 600;

type Estimate =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; pricing: Pricing }
  | { status: 'error'; message: string };

/** Estimation à blanc relancée après une pause de saisie, jamais à chaque frappe ; réponses périmées ignorées. */
function useEstimate(requestId: string, values: Values, cleaningTypeIds: string[], enabled: boolean) {
  const [estimate, setEstimate] = useState<Estimate>({ status: 'idle' });
  const key = JSON.stringify([values, cleaningTypeIds]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      setEstimate({ status: 'loading' });
      const [nextValues, nextTypes] = JSON.parse(key) as [Values, string[]];
      estimateRetainedValues(requestId, { values: nextValues, cleaningTypeIds: nextTypes }).then(
        (pricing) => active && setEstimate({ status: 'ready', pricing }),
        (error: unknown) => active && setEstimate({ status: 'error', message: errorText(error) }),
      );
    }, ESTIMATE_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestId, key, enabled]);
  return estimate;
}

const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

function Form({
  refs,
  request,
  onChange,
  onClose,
}: StepProps & { refs: ValueReferences; onClose: () => void }) {
  const form = useFormSubmit(FIELDS);
  const requested = request.cleaningTypes.map((type) => type.id);
  const observed = latestObserved(request) ?? request.declaredValues;
  const [types, setTypes] = useState<string[]>(
    request.retained?.cleaningTypes.map((type) => type.id) ?? requested,
  );
  const [draft, setDraft] = useState<ValueDraft>(() => draftOf(request.retained?.values ?? observed));
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (request.retained?.reasons ?? []).map((reason) => [
        reason.parameterCode ?? reason.cleaningTypeId ?? '',
        reason.reason,
      ]),
    ),
  );
  const [reason, setReason] = useState('');
  const parameters = useMemo(() => askedParameters(refs, types), [refs, types]);
  const values = valuesOf(draft, parameters);
  const local = valueErrors(draft, parameters);
  const estimate = useEstimate(request.id, values, types, types.length > 0 && !Object.keys(local).length);
  const names = new Map(refs.types.map((type) => [type.id, type.name]));
  const typeOptions = refs.offers.map((offer) => ({
    id: offer.cleaningTypeId,
    label: names.get(offer.cleaningTypeId) ?? offer.cleaningTypeId,
    disabled: !offer.active && !requested.includes(offer.cleaningTypeId),
  }));
  const changed = parameters.filter((parameter) => !same(values[parameter.code], observed[parameter.code]));
  const typeChanges = [
    ...types.filter((id) => !requested.includes(id)).map((id) => ({ id, added: true })),
    ...requested.filter((id) => !types.includes(id)).map((id) => ({ id, added: false })),
  ];
  const revising = request.status === 'quote_sent';

  function validate(): FieldErrors {
    const errors: FieldErrors = { ...local };
    if (!types.length) errors.cleaningTypeIds = t.noType;
    for (const key of [
      ...changed.map((parameter) => parameter.code),
      ...typeChanges.map((change) => change.id),
    ]) {
      const text = (reasons[key] ?? '').trim();
      if (!text) errors[`reasons.${key}`] = c.required;
      else if (text.length > MAX_REASON) errors[`reasons.${key}`] = c.tooLong(MAX_REASON);
    }
    if (revising && !reason.trim()) errors.reason = c.required;
    if (reason.length > MAX_REASON) errors.reason = c.tooLong(MAX_REASON);
    return errors;
  }

  async function send() {
    const body: ValueReason[] = [
      ...changed.map((parameter) => ({
        parameterCode: parameter.code,
        cleaningTypeId: null,
        reason: (reasons[parameter.code] ?? '').trim(),
      })),
      ...typeChanges.map((change) => ({
        parameterCode: null,
        cleaningTypeId: change.id,
        reason: (reasons[change.id] ?? '').trim(),
      })),
    ];
    onChange(
      await saveRetainedValues(request.id, {
        values,
        cleaningTypeIds: types,
        reasons: body,
        reason: reason.trim() || undefined,
      }),
    );
    onClose();
  }

  const reasonField = (key: string, label: string) => (
    <TextAreaField
      key={key}
      id={`retenu-motif-${key}`}
      label={label}
      rows={2}
      maxLength={MAX_REASON}
      value={reasons[key] ?? ''}
      error={form.errors[`reasons.${key}`]}
      onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))}
    />
  );

  return (
    <form
      noValidate
      aria-label={t.edit}
      onSubmit={(event) => void form.submit(event, validate(), send)}
      className="rounded-control bg-surface-muted grid gap-4 p-3 sm:p-4"
    >
      <OrderedPicker
        id="retenu-types"
        legend={t.types}
        hint={t.typesHint}
        options={typeOptions}
        value={types}
        onChange={setTypes}
        error={form.errors.cleaningTypeIds}
        empty={c.none}
        ordered={false}
      />
      <FieldGroup id="retenu-valeurs" legend={t.values}>
        <ValueFields
          idPrefix="retenu-valeur"
          parameters={parameters}
          draft={draft}
          errors={form.errors}
          onChange={(code, value) => setDraft((current) => ({ ...current, [code]: value }))}
        />
      </FieldGroup>
      {changed.map((parameter) => reasonField(parameter.code, t.valueReason(parameter.label)))}
      {typeChanges.map((change) =>
        reasonField(change.id, t.typeReason(names.get(change.id) ?? change.id, change.added)),
      )}
      {revising ? (
        <TextAreaField
          id="retenu-motif"
          label={t.reason}
          hint={t.reasonHint}
          maxLength={MAX_REASON}
          value={reason}
          error={form.errors.reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      <section
        aria-labelledby="retenu-estimation"
        aria-live="polite"
        className="rounded-control border-line bg-surface grid gap-2 border p-3"
      >
        <h3 id="retenu-estimation" className="text-ink font-semibold">
          {t.estimate}
        </h3>
        <p className="text-small text-ink-muted">{t.estimateHint}</p>
        {estimate.status === 'loading' ? <p className="text-small text-ink-muted">{t.estimating}</p> : null}
        {estimate.status === 'ready' ? <PricingSummary pricing={estimate.pricing} /> : null}
        {estimate.status === 'error' ? (
          <FormMessage>{`${t.estimateError} ${estimate.message}`}</FormMessage>
        ) : null}
      </section>
      <FormFooter pending={form.pending} message={form.message} label={t.submit} />
    </form>
  );
}

/** Ajustement de la version retenue : catalogue du lieu lu d'abord (paramètres, offres, types). */
export function RetainedForm(props: StepProps & { onClose: () => void }) {
  const placeTypeId = props.request.place.placeTypeId;
  const refs = useResource(useCallback(() => loadValueReferences(placeTypeId), [placeTypeId]));
  return (
    <ResourceView resource={refs} lines={6}>
      {(loaded) => <Form {...props} refs={loaded} />}
    </ResourceView>
  );
}
