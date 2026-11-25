'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { beninInputToIso, formatDateTime, formatDuration, isoToBeninInput } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { agentConfirmation, cancelCause, visitStatus } from '@/features/cleaning/request-detail-texts';
import { cancelVisit, removeVisitPhoto, reportVisitMissed } from '@/features/cleaning/requests-api';
import type { Visit } from '@/features/cleaning/requests-schemas';
import { visitTexts } from '@/features/cleaning/request-work-texts';
import {
  confirmLabels,
  PhotoLinks,
  ReasonField,
  reasonError,
  reasonOf,
  scalarText,
  StatusBadge,
  type StepProps,
  useKeyed,
} from './request-parts';
import { CompleteVisitForm } from './request-visit-complete';
import { VisitForm } from './request-visit-form';

const t = visitTexts;

/** Visite encore modifiable : planifiée ou commencée. */
const isOpen = (visit: Visit) => visit.status === 'scheduled' || visit.status === 'in_progress';

function Agents({ visit }: { visit: Visit }) {
  if (!visit.agents.length) return <span className="text-ink-muted">{t.noAgent}</span>;
  return (
    <ul className="grid gap-1">
      {visit.agents.map((agent) => (
        <li key={agent.agentId}>
          {agent.firstName} {agent.lastName}
          <span className="text-small text-ink-muted">
            {' '}
            (
            {[agent.isLead ? t.lead : null, agentConfirmation(agent.confirmation)].filter(Boolean).join(', ')}
            )
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Une visite du dossier : ce qui s'est passé, et les gestes de KSP tant qu'elle est ouverte. */
export function VisitCard({ visit, ...props }: StepProps & { visit: Visit }) {
  const { request, onRefresh, access } = props;
  const keyed = useKeyed();
  const [form, setForm] = useState<'move' | 'complete' | null>(null);
  const canProcess = access['cleaning.request.process'];
  const labels = new Map(request.declaredRows.map((row) => [row.code, row.label]));
  const arrival = visit.arrival;
  const closeAndRefresh = () => {
    setForm(null);
    onRefresh();
  };
  const done = async (action: (key: string) => Promise<Visit>) => {
    await keyed(action);
    closeAndRefresh();
  };

  return (
    <article
      aria-label={formatDateTime(visit.scheduledAt)}
      className="rounded-control border-line grid gap-3 border p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink font-semibold">{formatDateTime(visit.scheduledAt)}</h3>
        <StatusBadge status={visitStatus(visit.status)} />
        {arrival?.alert ? <Badge tone="warning">{t.arrivalAlert}</Badge> : null}
      </div>
      <DescriptionList
        items={[
          {
            term: t.duration,
            value: [
              formatDuration(visit.durationMinutes),
              visit.travelMinutes === null ? null : t.travel(visit.travelMinutes),
            ]
              .filter(Boolean)
              .join(' · '),
          },
          { term: t.agents, value: <Agents visit={visit} /> },
          {
            term: t.arrival,
            value: arrival
              ? `${t.arrivalValue(formatDateTime(arrival.arrivedAt), arrival.distanceMeters)}${arrival.uncertain ? ` (${t.arrivalUncertain})` : ''}`
              : null,
          },
          {
            term: t.observed,
            value: visit.observedValues ? (
              <ul className="grid gap-1">
                {Object.entries(visit.observedValues).map(([code, value]) => (
                  <li key={code}>
                    {labels.get(code) ?? code} : {scalarText(value)}
                  </li>
                ))}
              </ul>
            ) : null,
          },
          { term: t.note, value: visit.note },
          {
            term: t.completion,
            value: visit.completedAt ? t.completedAt(formatDateTime(visit.completedAt)) : null,
          },
          { term: t.absence, value: visit.missedAt ? t.missedAt(formatDateTime(visit.missedAt)) : null },
          {
            term: t.cancellation,
            value: visit.cancelledAt
              ? t.cancelledAt(
                  formatDateTime(visit.cancelledAt),
                  visit.cancelCause ? cancelCause(visit.cancelCause) : '—',
                )
              : null,
          },
          {
            term: t.photos,
            value: visit.photos.length ? (
              <PhotoLinks
                photos={visit.photos}
                label={(rank) => t.openPhoto(rank)}
                action={
                  canProcess
                    ? (photo, rank) => (
                        <ConfirmAction
                          label={t.removePhoto.open(rank)}
                          title={t.removePhoto.title}
                          description={t.removePhoto.text}
                          confirmLabel={t.removePhoto.confirm}
                          labels={confirmLabels}
                          danger
                          onConfirm={async (data) => {
                            const reason = reasonOf(data);
                            const invalid = reasonError(reason);
                            if (invalid) return invalid;
                            return attempt(() =>
                              done((key) => removeVisitPhoto(visit.id, photo.fileId, { reason }, key)),
                            );
                          }}
                        >
                          <ReasonField id={`photo-${photo.fileId}-motif`} />
                        </ConfirmAction>
                      )
                    : undefined
                }
              />
            ) : null,
          },
        ]}
      />
      {canProcess && isOpen(visit) ? (
        <div className="flex flex-wrap gap-3">
          {visit.status === 'scheduled' ? (
            <Button
              variant="secondary"
              aria-expanded={form === 'move'}
              onClick={() => setForm(form === 'move' ? null : 'move')}
            >
              {t.schedule.move}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            aria-expanded={form === 'complete'}
            onClick={() => setForm(form === 'complete' ? null : 'complete')}
          >
            {t.complete.open}
          </Button>
          <ConfirmAction
            label={t.missed.open}
            title={t.missed.title}
            description={t.missed.text}
            confirmLabel={t.missed.confirm}
            labels={confirmLabels}
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              const missedAt = beninInputToIso(String(data.get('missedAt') ?? ''));
              const invalid = reasonError(reason) ?? (missedAt ? null : t.schedule.invalidWhen);
              if (invalid || !missedAt) return invalid;
              return attempt(() => done((key) => reportVisitMissed(visit.id, { reason, missedAt }, key)));
            }}
          >
            <TextField
              id={`absence-${visit.id}-heure`}
              name="missedAt"
              type="datetime-local"
              label={t.missed.at}
              defaultValue={isoToBeninInput(new Date().toISOString())}
            />
            <ReasonField id={`absence-${visit.id}-motif`} />
          </ConfirmAction>
          <ConfirmAction
            label={t.cancel.open}
            title={t.cancel.title}
            description={t.cancel.text}
            confirmLabel={t.cancel.confirm}
            labels={confirmLabels}
            danger
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              const invalid = reasonError(reason);
              if (invalid) return invalid;
              const cause = data.get('cause') === 'agent_no_show' ? 'agent_no_show' : 'ksp';
              return attempt(() => done((key) => cancelVisit(visit.id, { cause, reason }, key)));
            }}
          >
            <SelectField
              id={`annulation-${visit.id}-cause`}
              name="cause"
              label={t.cancel.cause}
              defaultValue="ksp"
            >
              <option value="ksp">{t.cancel.causes.ksp}</option>
              <option value="agent_no_show">{t.cancel.causes.agent_no_show}</option>
            </SelectField>
            <ReasonField id={`annulation-${visit.id}-motif`} />
          </ConfirmAction>
        </div>
      ) : null}
      {form === 'move' ? <VisitForm {...props} visit={visit} onDone={closeAndRefresh} /> : null}
      {form === 'complete' ? <CompleteVisitForm {...props} visit={visit} onDone={closeAndRefresh} /> : null}
    </article>
  );
}
