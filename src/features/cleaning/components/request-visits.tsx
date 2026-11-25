'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { attempt } from '@/features/cleaning/errors';
import { requestNewVisit } from '@/features/cleaning/requests-api';
import { visitTexts } from '@/features/cleaning/request-work-texts';
import {
  confirmLabels,
  ReasonField,
  reasonError,
  reasonOf,
  type StepProps,
  StepSection,
  useKeyed,
} from './request-parts';
import { VisitCard } from './request-visit-card';
import { VisitForm } from './request-visit-form';
import { Note } from './parts';

const t = visitTexts;

/** Nouvelle visite possible depuis « visite faite » ou « devis envoyé » (R-VI-07). */
const NEW_VISIT = ['visit_done', 'quote_sent'];

/** Étape 2 « Visite » : planifier, puis suivre et corriger chaque visite ; nouvelle visite. */
export function RequestVisits(props: StepProps) {
  const { request, onChange, onRefresh, access } = props;
  const keyed = useKeyed();
  const canProcess = access['cleaning.request.process'];
  const toSchedule = request.status === 'visit_to_schedule';
  const [planning, setPlanning] = useState(toSchedule);
  return (
    <StepSection
      step="visit"
      title={t.title}
      action={
        canProcess && toSchedule && !planning ? (
          <Button variant="action" onClick={() => setPlanning(true)}>
            {t.schedule.open}
          </Button>
        ) : null
      }
    >
      {canProcess && toSchedule && planning ? (
        <VisitForm
          {...props}
          onDone={() => {
            setPlanning(false);
            onRefresh();
          }}
        />
      ) : null}
      {request.visits.length ? (
        <div className="grid gap-3">
          {request.visits.map((visit) => (
            <VisitCard key={visit.id} {...props} visit={visit} />
          ))}
        </div>
      ) : (
        <Note>{t.none}</Note>
      )}
      {canProcess && NEW_VISIT.includes(request.status) ? (
        <div>
          <ConfirmAction
            label={t.newVisit.open}
            title={t.newVisit.title}
            description={t.newVisit.text}
            confirmLabel={t.newVisit.confirm}
            labels={confirmLabels}
            onConfirm={async (data) => {
              const reason = reasonOf(data);
              const invalid = reasonError(reason);
              if (invalid) return invalid;
              return attempt(async () =>
                onChange(await keyed((key) => requestNewVisit(request.id, { reason }, key))),
              );
            }}
          >
            <ReasonField id="nouvelle-visite-motif" />
          </ConfirmAction>
        </div>
      ) : null}
    </StepSection>
  );
}
