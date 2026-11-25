'use client';

import { useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { formatDateTime } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { optionalText, parseInteger } from '@/features/cleaning/inputs';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import {
  correctRequestLocation,
  decideReactivation,
  type LocationBody,
  type RejectReasonCode,
  rejectRequest,
} from '@/features/cleaning/requests-api';
import { cleaningTexts } from '@/features/cleaning/texts';
import {
  confirmLabels,
  MAX_REASON,
  ReasonField,
  reasonError,
  reasonOf,
  type StepProps,
  useKeyed,
} from './request-parts';

const t = requestDetailTexts;
const c = cleaningTexts.common;

/** Refus possible à toute étape avant l'acceptation (R-AC-05). */
const REJECTABLE = [
  'awaiting_visit_fee',
  'visit_to_schedule',
  'visit_scheduled',
  'visit_missed',
  'visit_done',
  'quote_sent',
];
/** Position corrigeable tant que le dossier n'est pas clos (R-DM-07). */
const LOCATABLE = [...REJECTABLE, 'accepted'];

const decimal = (raw: string) => {
  const value = Number(raw.trim().replace(',', '.'));
  return raw.trim() && Number.isFinite(value) ? value : null;
};

/** Corps de la correction lu dans la boîte, ou le message d'erreur à afficher. */
function locationBody(data: FormData): LocationBody | string {
  const latitude = decimal(String(data.get('latitude') ?? ''));
  const longitude = decimal(String(data.get('longitude') ?? ''));
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return t.location.invalid;
  }
  const rawAccuracy = String(data.get('accuracy') ?? '').trim();
  const accuracy = rawAccuracy ? parseInteger(rawAccuracy) : undefined;
  if (accuracy === null || (accuracy !== undefined && accuracy > 100_000)) return c.between(0, 100_000);
  const reason = reasonOf(data);
  const invalid = reasonError(reason);
  if (invalid) return `${t.location.reason} : ${invalid}`;
  return {
    latitude,
    longitude,
    accuracyMeters: accuracy,
    landmark: optionalText(String(data.get('landmark') ?? '')),
    address: optionalText(String(data.get('address') ?? '')),
    reason,
  };
}

function Reactivation({ request, onChange, access }: StepProps) {
  const keyed = useKeyed();
  const reactivation = request.reactivation;
  if (!reactivation) return null;
  const pending = reactivation.status === 'pending';
  const decide = (decision: 'accept' | 'refuse', reason?: string) =>
    attempt(async () =>
      onChange(await keyed((key) => decideReactivation(request.id, { decision, reason }, key))),
    );
  return (
    <div className="rounded-control border-line grid gap-2 border p-3">
      <h3 className="text-ink font-semibold">{t.reactivation.title}</h3>
      <p className="text-small text-ink-muted">
        {t.reactivation.requested(formatDateTime(reactivation.requestedAt))}{' '}
        {t.reactivation.statuses[reactivation.status] ?? reactivation.status}
      </p>
      {pending && access['cleaning.quote.manage'] ? (
        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            label={t.reactivation.accept}
            title={t.reactivation.acceptTitle}
            description={t.reactivation.acceptText}
            confirmLabel={t.reactivation.accept}
            labels={confirmLabels}
            variant="action"
            onConfirm={() => decide('accept')}
          />
          <ConfirmAction
            label={t.reactivation.refuse}
            title={t.reactivation.refuseTitle}
            description={t.reactivation.refuseText}
            confirmLabel={t.reactivation.refuse}
            labels={confirmLabels}
            danger
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              if (reason.length > MAX_REASON) return c.tooLong(MAX_REASON);
              return decide('refuse', reason || undefined);
            }}
          >
            <ReasonField id="reactivation-motif" label={t.reactivation.reason} required={false} />
          </ConfirmAction>
        </div>
      ) : null}
    </div>
  );
}

/** Décisions sur le dossier : réactivation, correction de la position, refus. */
export function RequestDecisions(props: StepProps) {
  const { request, onChange, onRefresh, access } = props;
  const keyed = useKeyed();
  const [done, setDone] = useState<string | null>(null);
  const canProcess = access['cleaning.request.process'];
  const location = request.place.location;
  return (
    <div className="grid gap-4">
      <Reactivation {...props} />
      <FormMessage tone="success">{done}</FormMessage>
      {canProcess ? (
        <div className="flex flex-wrap gap-3">
          {LOCATABLE.includes(request.status) ? (
            <ConfirmAction
              label={t.location.open}
              title={t.location.title}
              description={t.location.text}
              confirmLabel={t.location.confirm}
              labels={confirmLabels}
              onOpen={() => setDone(null)}
              onConfirm={async (data) => {
                const body = locationBody(data);
                if (typeof body === 'string') return body;
                return attempt(async () => {
                  const result = await keyed((key) => correctRequestLocation(request.id, body, key));
                  setDone(t.location.done(result.communeName, result.communeChanged));
                  onRefresh();
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="position-latitude"
                  name="latitude"
                  label={t.location.latitude}
                  inputMode="decimal"
                  defaultValue={location ? String(location.latitude) : ''}
                  required
                />
                <TextField
                  id="position-longitude"
                  name="longitude"
                  label={t.location.longitude}
                  inputMode="decimal"
                  defaultValue={location ? String(location.longitude) : ''}
                  required
                />
              </div>
              <TextField
                id="position-precision"
                name="accuracy"
                label={t.location.accuracy}
                inputMode="numeric"
              />
              <TextField id="position-repere" name="landmark" label={t.location.landmark} maxLength={300} />
              <TextField id="position-adresse" name="address" label={t.location.address} maxLength={300} />
              <ReasonField id="position-motif" label={t.location.reason} />
            </ConfirmAction>
          ) : null}
          {REJECTABLE.includes(request.status) ? (
            <ConfirmAction
              label={t.reject.open}
              title={t.reject.title}
              description={t.reject.text}
              confirmLabel={t.reject.confirm}
              labels={confirmLabels}
              danger
              onConfirm={async (data) => {
                const reason = reasonOf(data);
                const invalid = reasonError(reason);
                if (invalid) return `${t.reject.reason} : ${invalid}`;
                const reasonCode = String(data.get('reasonCode') ?? 'other') as RejectReasonCode;
                return attempt(async () =>
                  onChange(await keyed((key) => rejectRequest(request.id, { reasonCode, reason }, key))),
                );
              }}
            >
              <SelectField
                id="refus-raison"
                name="reasonCode"
                label={t.reject.reasonCode}
                defaultValue="other"
              >
                {(Object.keys(t.reject.reasons) as RejectReasonCode[]).map((code) => (
                  <option key={code} value={code}>
                    {t.reject.reasons[code]}
                  </option>
                ))}
              </SelectField>
              <ReasonField id="refus-motif" label={t.reject.reason} />
            </ConfirmAction>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
