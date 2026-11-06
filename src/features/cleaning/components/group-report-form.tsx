'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, newIdempotencyKey } from '@/lib/api';
import { completeGroupVisit, estimateRequest, type MeasurementInput } from '@/features/cleaning/api';
import {
  changedKeys,
  errorKey,
  type FormErrors,
  type FormModel,
  type FormValues,
  initialValues,
  modelFromPublicForm,
  readValues,
  summaryDisplays,
} from '@/features/cleaning/form-model';
import { groupErrorText, serviceLabel } from '@/features/cleaning/group-errors';
import { groupTexts as g } from '@/features/cleaning/group-texts';
import { measureTexts } from '@/features/cleaning/measure-texts';
import type { Calculation, GroupOutcome, QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { clientSource, measuredSource } from './measurements-panel';
import { Note } from './parts';
import { PricePanel } from './price-panel';
import { ServiceFields } from './service-fields';
import { useLivePrice } from './use-live-price';
import { useServiceForm } from './use-service-names';

const t = measureTexts.measures;
const formMessages = measureTexts.form;
const common = cleaningTexts.common;

/** Mesures d'une demande de la visite commune : jointes au compte rendu si la case est cochée. */
interface Entry {
  included: boolean;
  model: FormModel | null;
  values: FormValues | null;
}

function MeasureEntry({
  request,
  entry,
  errors,
  onChange,
}: {
  request: QuoteRequest;
  entry: Entry;
  errors: FormErrors;
  onChange: (entry: Entry) => void;
}) {
  const form = useServiceForm(request.serviceCode);
  const model = useMemo(() => (form ? modelFromPublicForm(form) : null), [form]);
  const values = entry.values ?? (model ? initialValues(model, measuredSource(request)) : null);
  const read = model && values ? readValues(model, values, formMessages) : null;
  const ready = read && !Object.keys(read.errors).length ? read.body : null;
  const estimate = useCallback(
    async (input: MeasurementInput): Promise<Calculation> =>
      (await estimateRequest(request.id, input)).calculation,
    [request.id],
  );
  const price = useLivePrice(estimate, entry.included ? ready : null);
  const client = clientSource(request);
  const service = serviceLabel(request);
  const prefix = `mesures-groupe-${request.id}`;

  return (
    <fieldset className="rounded-card border-line grid gap-4 border p-3 sm:p-4">
      <legend className="text-ink px-1 font-semibold">{t.openFor(service)}</legend>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="accent-brand size-5"
          checked={entry.included}
          onChange={(event) => onChange({ ...entry, model, values, included: event.target.checked })}
        />
        {g.measures.include(service)}
      </label>
      {form === undefined ? <Note>{t.loadingForm}</Note> : null}
      {form === null ? <FormMessage tone="info">{t.noForm}</FormMessage> : null}
      {entry.included && model && values ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
          <ServiceFields
            model={model}
            values={values}
            onChange={(next) => onChange({ included: true, model, values: next })}
            errors={errors}
            idPrefix={prefix}
            declared={request.answerSummary && client ? summaryDisplays(request.answerSummary) : undefined}
            changed={client ? changedKeys(model, values, client) : undefined}
          />
          <PricePanel price={price} model={model} announced={request.calculation} />
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * Compte rendu commun d'une visite de groupe (`POST …/quote-request-groups/{id}/visits/complete`), avec les
 * mesures constatées des demandes cochées (ADR-037, tout ou rien) ; les autres gardent les réponses du client.
 * `Idempotency-Key` tirée à l'ouverture du formulaire, renvoyée telle quelle si l'agent renvoie.
 */
export function GroupReportForm({
  groupId,
  requests,
  onCancel,
  onDone,
}: {
  groupId: string;
  /** Demandes de la visite commune encore planifiée. */
  requests: QuoteRequest[];
  onCancel: () => void;
  onDone: (outcome: GroupOutcome) => void;
}) {
  const [key] = useState(() => newIdempotencyKey());
  const [report, setReport] = useState('');
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [errors, setErrors] = useState<Record<string, FormErrors>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Clôt la visite commune ; renvoie le message d'échec (affiché dans la boîte de confirmation), `null` si réussi. */
  async function submit(): Promise<string | null> {
    if (pending) return null;
    setMessage(null);
    const text = report.trim();
    if (!text) {
      setMessage(g.measures.reportRequired);
      return g.measures.reportRequired;
    }
    const measurements: Array<MeasurementInput & { requestId: string }> = [];
    const local: Record<string, FormErrors> = {};
    for (const request of requests) {
      const entry = entries[request.id];
      if (!entry?.included || !entry.model) continue;
      const values = entry.values ?? initialValues(entry.model, measuredSource(request));
      const { body, errors: found } = readValues(entry.model, values, formMessages);
      if (Object.keys(found).length) local[request.id] = found;
      else measurements.push({ requestId: request.id, ...body });
    }
    setErrors(local);
    if (Object.keys(local).length) {
      setMessage(t.fixErrors);
      return t.fixErrors;
    }
    setPending(true);
    try {
      onDone(await completeGroupVisit(groupId, text, key, measurements));
      return null;
    } catch (error) {
      const field = error instanceof ApiError ? error.details.field : undefined;
      const index = typeof field === 'string' ? /^measurements\[(\d+)\]/.exec(field) : null;
      const target = index ? measurements[Number(index[1])] : undefined;
      const fieldKey = target && typeof field === 'string' ? errorKey(field, target) : null;
      if (target && fieldKey && error instanceof ApiError) {
        const request = requests.find((r) => r.id === target.requestId);
        const text = g.requestError(request ? serviceLabel(request) : '', error.message);
        setErrors({ [target.requestId]: { [fieldKey]: error.message } });
        setMessage(text);
        return text;
      }
      const text = groupErrorText(error, requests);
      setMessage(text);
      return text;
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="compte-rendu-commun-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <div>
        <h2 id="compte-rendu-commun-titre" className="font-display text-h3 text-ink font-semibold">
          {g.report.title}
        </h2>
        <p className="text-small text-ink-muted mt-1">{g.report.text}</p>
      </div>
      <TextAreaField
        id="visite-groupe-compte-rendu"
        label={g.report.field}
        hint={g.report.hint}
        rows={5}
        maxLength={5000}
        value={report}
        onChange={(event) => setReport(event.target.value)}
      />
      <div className="grid gap-3">
        <p className="text-ink font-semibold">{g.measures.title}</p>
        <p className="text-small text-ink-muted">{g.measures.lead}</p>
        {requests.map((request) => (
          <MeasureEntry
            key={request.id}
            request={request}
            entry={entries[request.id] ?? { included: false, model: null, values: null }}
            errors={errors[request.id] ?? {}}
            onChange={(entry) => {
              setEntries((previous) => ({ ...previous, [request.id]: entry }));
              setErrors((previous) => ({ ...previous, [request.id]: {} }));
            }}
          />
        ))}
      </div>
      <FormMessage>{message}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <ConfirmAction
          label={g.report.confirm}
          variant="action"
          title={g.measures.closeTitle}
          description={g.measures.closeText(requests.length)}
          confirmLabel={g.report.confirm}
          labels={{ cancel: common.cancel, pending: common.sending }}
          onConfirm={submit}
        />
        <Button variant="ghost" onClick={onCancel}>
          {common.cancel}
        </Button>
      </div>
    </section>
  );
}
