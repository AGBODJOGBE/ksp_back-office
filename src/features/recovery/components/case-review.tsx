'use client';

import { useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import type { RecoveryAccess } from '@/features/recovery/access';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import { type Case, REJECTION_REASONS, type RejectionReason } from '@/features/recovery/case-schemas';
import { rejectionLabel } from '@/features/recovery/case-texts';
import { type Assessment, assessCase, assignCase } from '@/features/recovery/cases-api';
import { attempt } from '@/features/recovery/errors';
import { actorName, recoveryTexts } from '@/features/recovery/texts';
import { AgentField, chosenAgent, confirmLabels, field, idempotent, type OnDone } from './case-action-parts';
import { Note, Panel, useIdempotencyKey } from './parts';

const t = caseActionTexts.review;
const a = caseActionTexts.assign;
const c = recoveryTexts.common;

/**
 * Recevabilité (UC-RC-14) : recevable (affectation facultative), complément demandé, irrecevable.
 * Réservée au superviseur et à l'administrateur (rôles du contrat) ; idempotente.
 */
export function CaseReview({ item, access, onDone }: { item: Case; access: RecoveryAccess; onDone: OnDone }) {
  const key = useIdempotencyKey();
  const [opened, setOpened] = useState(false);
  const decide = (body: Assessment, message: string) =>
    attempt(async () => {
      await idempotent(key, (value) => assessCase(item.id, body, value));
      onDone(message);
    });
  const decidable = item.status === 'under_review';

  return (
    <Panel title={t.title} id="dossier-recevabilite">
      <p className="text-ink-muted">{t.lead}</p>
      {item.status === 'info_requested' ? <Note>{t.waiting}</Note> : null}
      {decidable && !access.assess ? <Note>{t.reserved}</Note> : null}
      {decidable && access.assess ? (
        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            label={t.accept}
            title={t.acceptTitle}
            description={t.acceptText}
            confirmLabel={t.accept}
            labels={confirmLabels}
            variant="action"
            onOpen={() => setOpened(true)}
            onConfirm={(data) => {
              const agent = chosenAgent(data);
              if (agent === null) return Promise.resolve(a.invalid);
              const note = field(data, 'note');
              return decide(
                { decision: 'accept', ...(agent ? { agentUserId: agent } : {}), ...(note ? { note } : {}) },
                t.accepted,
              );
            }}
          >
            {opened ? <AgentField id="recevable-charge" optional /> : null}
          </ConfirmAction>
          <ConfirmAction
            label={t.requestInfo}
            title={t.requestInfoTitle}
            description={t.requestInfoText}
            confirmLabel={t.requestInfo}
            labels={confirmLabels}
            onConfirm={(data) => {
              const note = field(data, 'note');
              return decide({ decision: 'request_info', ...(note ? { note } : {}) }, t.infoRequested);
            }}
          >
            <TextAreaField id="complement-note" name="note" label={t.note} maxLength={2000} />
          </ConfirmAction>
          <ConfirmAction
            label={t.reject}
            title={t.rejectTitle}
            description={t.rejectText}
            confirmLabel={t.reject}
            labels={confirmLabels}
            danger
            onConfirm={(data) => {
              const reason = field(data, 'reason') as RejectionReason;
              const note = field(data, 'note');
              return decide(
                { decision: 'reject', rejectionReason: reason, ...(note ? { note } : {}) },
                t.rejected,
              );
            }}
          >
            <SelectField id="refus-motif" name="reason" label={t.reason} defaultValue="no_evidence">
              {REJECTION_REASONS.map((value) => (
                <option key={value} value={value}>
                  {rejectionLabel(value)}
                </option>
              ))}
            </SelectField>
            <TextAreaField id="refus-note" name="note" label={t.note} maxLength={2000} />
          </ConfirmAction>
        </div>
      ) : null}
    </Panel>
  );
}

/** Affectation à un chargé (superviseur, administrateur) : dossier à l'examen ou actif. */
export function CaseAssignment({
  item,
  access,
  onDone,
}: {
  item: Case;
  access: RecoveryAccess;
  onDone: OnDone;
}) {
  const [opened, setOpened] = useState(false);
  const assignable = ['under_review', 'active', 'suspended'].includes(item.status);
  return (
    <Panel title={a.title} id="dossier-affectation">
      <p>{item.assignedAgent ? actorName(item.assignedAgent) : caseDetailTexts.summary.unassigned}</p>
      {assignable && access.assess ? (
        <div>
          <ConfirmAction
            label={item.assignedAgent ? a.reassign : a.open}
            title={a.dialog}
            description={a.text}
            confirmLabel={a.open}
            labels={confirmLabels}
            onOpen={() => setOpened(true)}
            onConfirm={(data) => {
              const agent = chosenAgent(data);
              if (!agent) return Promise.resolve(a.invalid);
              return attempt(async () => {
                const updated = await assignCase(item.id, agent);
                onDone(a.assigned(updated.assignedAgent ? actorName(updated.assignedAgent) : c.someone));
              });
            }}
          >
            {opened ? <AgentField id="affecter-charge" /> : null}
          </ConfirmAction>
        </div>
      ) : null}
    </Panel>
  );
}
