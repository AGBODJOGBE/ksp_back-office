'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  completeVisit,
  estimateRequest,
  type MeasurementInput,
  saveMeasurements,
} from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import {
  type AnswerSource,
  changedKeys,
  compareSummaries,
  fieldError,
  type FormErrors,
  type FormModel,
  type FormValues,
  initialValues,
  modelFromPublicForm,
  readValues,
  summaryDisplays,
} from '@/features/cleaning/form-model';
import { measureTexts } from '@/features/cleaning/measure-texts';
import type { Calculation, QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts, nameOr } from '@/features/cleaning/texts';
import { Note } from './parts';
import { PricePanel } from './price-panel';
import { ServiceFields } from './service-fields';
import { useLivePrice } from './use-live-price';
import { useServiceForm } from './use-service-names';

const t = measureTexts.measures;
const formMessages = measureTexts.form;

/** Réponses du client (nouveau format) ; `null` pour une demande à l'ancien format ou inconnue (agent). */
export function clientSource(request: QuoteRequest | null): AnswerSource | null {
  if (!request?.answers) return null;
  return { answers: request.answers, options: request.selectedOptions, frequency: request.frequency };
}

/** Point de départ du formulaire : mesures déjà saisies, sinon réponses du client. */
export function measuredSource(request: QuoteRequest | null): AnswerSource | null {
  if (request?.measuredAnswers) {
    return {
      answers: request.measuredAnswers,
      options: request.measuredOptions ?? [],
      frequency: request.measuredFrequency ?? null,
    };
  }
  return clientSource(request);
}

/** Corps prêt à être envoyé (sans erreur locale), sinon `null`. */
export function readyBody(model: FormModel, values: FormValues): MeasurementInput | null {
  const { body, errors } = readValues(model, values, formMessages);
  return Object.keys(errors).length ? null : body;
}

/**
 * Comparaison « Déclaré par le client » / « Constaté » (`answerSummary`, `measuredSummary`), écarts mis en
 * évidence (fond, et mot « Écart » : le sens ne repose pas sur la couleur seule).
 */
export function MeasuredComparison({ request }: { request: QuoteRequest }) {
  const measured = request.measuredSummary;
  if (!measured) return null;
  const rows = compareSummaries(request.answerSummary ?? null, measured, {
    chosen: t.chosen,
    notChosen: t.notChosen,
    frequency: formMessages.frequency,
    option: t.option,
  });
  const gaps = rows.filter((row) => row.changed).length;
  return (
    <div className="grid gap-2">
      <p className="text-ink font-semibold">{t.compareTitle}</p>
      {request.measuredAt ? (
        <p className="text-small text-ink-muted">
          {t.savedBy(formatDateTime(request.measuredAt), nameOr(request.measuredByName, t.someone))}
        </p>
      ) : null}
      <p className="text-small text-ink">{t.gaps(gaps)}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <caption className="sr-only">{t.compareCaption}</caption>
          <thead>
            <tr className="text-small text-ink-muted border-line border-b">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.columns.label}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t.columns.declared}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t.columns.measured}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={cn('border-line border-b', row.changed && 'bg-warning-soft')}>
                <th scope="row" className="py-2 pr-3 font-medium">
                  {row.label}
                </th>
                <td className="py-2 pr-3">{row.declared ?? '—'}</td>
                <td className="py-2">
                  <span className={cn(row.changed && 'font-semibold')}>{row.measured ?? '—'}</span>
                  {row.changed ? (
                    <span className="text-small text-warning ml-2 font-semibold">{t.gap}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FormProps {
  requestId: string;
  model: FormModel;
  request: QuoteRequest | null;
  visitId: string | null;
  locked: boolean;
  idPrefix: string;
  onSaved: (request: QuoteRequest, withReport: boolean) => void;
}

function MeasurementsForm({
  requestId,
  model,
  request,
  visitId,
  locked: lockedAtStart,
  idPrefix,
  onSaved,
}: FormProps) {
  const client = clientSource(request);
  const [values, setValues] = useState<FormValues>(() => initialValues(model, measuredSource(request)));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [locked, setLocked] = useState(lockedAtStart);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const { body, errors } = useMemo(() => readValues(model, values, formMessages), [model, values]);
  const ready = Object.keys(errors).length === 0 && !locked;
  const estimate = useCallback(
    async (input: MeasurementInput): Promise<Calculation> =>
      (await estimateRequest(requestId, input)).calculation,
    [requestId],
  );
  const price = useLivePrice(estimate, ready ? body : null);
  const liveError = price.status === 'error' ? fieldError(price.error, body) : null;

  // Erreurs « obligatoire » montrées après un premier essai d'enregistrement ; les autres aussitôt.
  const shown: FormErrors = {
    ...Object.fromEntries(
      Object.entries(errors).filter(([, text]) => submitted || text !== formMessages.required),
    ),
    ...serverErrors,
    ...(liveError ? { [liveError.key]: liveError.message } : {}),
  };
  const changed = client ? changedKeys(model, values, client) : undefined;
  const declared = request?.answerSummary && client ? summaryDisplays(request.answerSummary) : undefined;

  const change = (next: FormValues) => {
    setValues(next);
    setServerErrors({});
    setMessage(null);
  };

  /** Enregistre ; avec un compte rendu, clôt aussi la visite. Renvoie le message d'échec, `null` si réussi. */
  async function save(report: string | null): Promise<string | null> {
    if (pending || locked) return null;
    const withReport = report !== null;
    const text = report?.trim() ?? '';
    setSubmitted(true);
    setMessage(null);
    if (Object.keys(errors).length) {
      setMessage({ tone: 'error', text: t.fixErrors });
      return t.fixErrors;
    }
    if (withReport && !text) return t.reportRequired;
    setPending(true);
    try {
      const next =
        withReport && visitId
          ? await completeVisit(visitId, text, body)
          : await saveMeasurements(requestId, body);
      setServerErrors({});
      setMessage({ tone: 'success', text: withReport ? t.savedWithReport : t.saved });
      onSaved(next, withReport);
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CLEANING_MEASUREMENTS_LOCKED') {
        setLocked(true);
        setMessage({ tone: 'error', text: t.locked });
        return t.locked;
      }
      const target = fieldError(error, body);
      if (target) {
        setServerErrors({ [target.key]: target.message });
        setMessage({ tone: 'error', text: t.fixErrors });
        return `${t.fixErrors} ${target.message}`;
      }
      setMessage({ tone: 'error', text: errorText(error) });
      return errorText(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {locked ? <FormMessage tone="info">{t.locked}</FormMessage> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <div className="grid gap-5">
          <ServiceFields
            model={model}
            values={values}
            onChange={change}
            errors={shown}
            disabled={locked || pending}
            idPrefix={idPrefix}
            declared={declared}
            changed={changed}
          />
          {client && !locked ? (
            <Button
              variant="ghost"
              className="justify-self-start"
              onClick={() => change(initialValues(model, client))}
            >
              {t.reset}
            </Button>
          ) : null}
        </div>
        <div className="lg:sticky lg:top-4">
          <PricePanel
            price={price}
            model={model}
            announced={request ? request.calculation : undefined}
            showError={!liveError}
          />
        </div>
      </div>

      {!locked ? (
        <div className="grid gap-4">
          <FormMessage tone={message?.tone ?? 'error'}>{message?.text}</FormMessage>
          <div className="flex flex-wrap gap-3">
            {visitId ? (
              <>
                <ConfirmAction
                  label={t.saveWithReport}
                  variant="action"
                  title={t.closeTitle}
                  description={t.closeText}
                  confirmLabel={t.closeConfirm}
                  labels={{ cancel: cleaningTexts.common.cancel, pending: cleaningTexts.common.sending }}
                  onConfirm={async (data) => save(String(data.get('report') ?? ''))}
                >
                  <TextAreaField
                    id={`${idPrefix}-compte-rendu`}
                    name="report"
                    label={t.report}
                    hint={t.reportHint}
                    rows={5}
                    maxLength={5000}
                    required
                  />
                </ConfirmAction>
                <Button variant="secondary" disabled={pending} onClick={() => void save(null)}>
                  {t.saveOnly}
                </Button>
              </>
            ) : (
              <Button
                variant="action"
                aria-busy={pending || undefined}
                disabled={pending}
                onClick={() => void save(null)}
              >
                {t.save}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <FormMessage tone={message?.tone ?? 'error'}>
          {message?.tone === 'success' ? message.text : null}
        </FormMessage>
      )}
    </div>
  );
}

/**
 * Mesures constatées après la visite (ADR-037) : formulaire de la prestation prérempli (mesures déjà saisies,
 * sinon réponses du client), prix recalculé à chaque modification (`POST …/estimate`), enregistrement seul
 * (`PUT …/measurements`) ou avec le compte rendu de la visite (`measurements` de la clôture). L'agent de la
 * visite n'a pas accès à la demande : `request` est alors `null` et le formulaire part vide.
 */
export function MeasurementsPanel({
  requestId,
  serviceCode,
  request,
  visitId,
  locked,
  idPrefix,
  onSaved,
}: {
  requestId: string;
  serviceCode: string;
  request: QuoteRequest | null;
  visitId: string | null;
  locked: boolean;
  idPrefix: string;
  onSaved: (request: QuoteRequest, withReport: boolean) => void;
}) {
  const form = useServiceForm(serviceCode);
  const model = useMemo(() => (form ? modelFromPublicForm(form) : null), [form]);
  return (
    <div className="grid gap-4">
      <p className="text-small text-ink-muted max-w-reading">{request ? t.lead : t.agentLead}</p>
      {request ? <MeasuredComparison request={request} /> : null}
      {form === undefined ? <Note>{t.loadingForm}</Note> : null}
      {form === null ? <FormMessage tone="info">{t.noForm}</FormMessage> : null}
      {model ? (
        <MeasurementsForm
          requestId={requestId}
          model={model}
          request={request}
          visitId={visitId}
          locked={locked}
          idPrefix={idPrefix}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
