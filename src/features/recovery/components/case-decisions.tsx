'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDateTime } from '@/lib/format';
import type { RecoveryAccess } from '@/features/recovery/access';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import { stageTargets } from '@/features/recovery/case-logic';
import {
  type Case,
  type Dispute,
  DISPUTE_RESOLUTIONS,
  type DisputeResolution,
} from '@/features/recovery/case-schemas';
import { disputeReasonLabel, disputeStatusLabel } from '@/features/recovery/case-texts';
import { changeStage, resolveDispute } from '@/features/recovery/cases-api';
import { attempt } from '@/features/recovery/errors';
import type { CaseStage } from '@/features/recovery/schemas';
import { actorName, stageLabel } from '@/features/recovery/texts';
import { confirmLabels, field, type OnDone, positiveAmount } from './case-action-parts';
import { Note } from './parts';

const s = caseActionTexts.stage;
const d = caseActionTexts.dispute;
const r = caseDetailTexts.disputes;

/** Changer d'étape : seulement vers les étapes amiables suivantes ; motif de 3 à 1 000 caractères. */
export function StageChange({ item, onDone }: { item: Case; onDone: OnDone }) {
  const targets = stageTargets(item);
  if (!targets.length) return null;
  return (
    <ConfirmAction
      label={s.open}
      title={s.title}
      description={s.text}
      confirmLabel={s.open}
      labels={confirmLabels}
      onConfirm={(data) => {
        const reason = field(data, 'reason');
        if (reason.length < 3 || reason.length > 1000) return Promise.resolve(s.reasonLength);
        const toStage = field(data, 'toStage') as CaseStage;
        return attempt(async () => {
          await changeStage(item.id, toStage, reason);
          onDone(s.changed(stageLabel(toStage)));
        });
      }}
    >
      <SelectField id="etape-cible" name="toStage" label={s.target} defaultValue={targets[0]}>
        {targets.map((value) => (
          <option key={value} value={value}>
            {stageLabel(value)}
          </option>
        ))}
      </SelectField>
      <TextAreaField id="etape-motif" name="reason" label={s.reason} hint={s.reasonHint} maxLength={1000} />
    </ConfirmAction>
  );
}

/** Champs de la décision : le montant corrigé n'apparaît que pour « Corriger le montant dû ». */
function ResolutionFields({ id }: { id: string }) {
  const [resolution, setResolution] = useState<DisputeResolution>('resume');
  return (
    <>
      <SelectField
        id={`${id}-decision`}
        name="resolution"
        label={d.resolution}
        value={resolution}
        onChange={(event) => setResolution(event.target.value as DisputeResolution)}
      >
        {DISPUTE_RESOLUTIONS.map((value) => (
          <option key={value} value={value}>
            {d[value]}
          </option>
        ))}
      </SelectField>
      {resolution === 'correct_amount' ? (
        <TextField id={`${id}-montant`} name="correctedDue" inputMode="numeric" label={d.correctedDue} />
      ) : null}
      <TextAreaField id={`${id}-motif`} name="note" label={d.note} maxLength={2000} />
    </>
  );
}

function DisputeCard({
  item,
  dispute,
  canResolve,
  onDone,
}: {
  item: Case;
  dispute: Dispute;
  canResolve: boolean;
  onDone: OnDone;
}) {
  const open = dispute.status === 'open' || dispute.status === 'creditor_answered';
  return (
    <li className="border-line grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{disputeReasonLabel(dispute.reason)}</span>
        <Badge tone={open ? 'warning' : 'neutral'} dot>
          {disputeStatusLabel(dispute.status)}
        </Badge>
      </div>
      <DescriptionList
        items={[
          { term: r.text, value: dispute.text },
          { term: r.opened, value: formatDateTime(dispute.openedAt) },
          {
            term: r.answerDue,
            value: dispute.status === 'open' ? formatDateTime(dispute.creditorAnswerDueAt) : null,
          },
          { term: r.answer, value: dispute.creditorAnswer },
          { term: r.resolution, value: dispute.resolutionNote },
        ]}
      />
      {open && canResolve ? (
        <div>
          <ConfirmAction
            label={d.open}
            title={d.title}
            description={d.text}
            confirmLabel={d.open}
            labels={confirmLabels}
            onConfirm={(data) => {
              const resolution = field(data, 'resolution') as DisputeResolution;
              const note = field(data, 'note');
              if (note.length < 3 || note.length > 2000) return Promise.resolve(d.noteLength);
              const corrected =
                resolution === 'correct_amount' ? positiveAmount(data, 'correctedDue') : undefined;
              if (corrected === null) return Promise.resolve(d.correctedRequired);
              return attempt(async () => {
                await resolveDispute(item.id, dispute.id, {
                  resolution,
                  note,
                  ...(corrected === undefined ? {} : { correctedDue: corrected }),
                });
                onDone(d.resolved);
              });
            }}
          >
            <ResolutionFields id={`contestation-${dispute.id}`} />
          </ConfirmAction>
        </div>
      ) : null}
    </li>
  );
}

/** Contestations du débiteur (R-PR-02) : tranchées par le juriste ou l'administrateur. */
export function Disputes({ item, access, onDone }: { item: Case; access: RecoveryAccess; onDone: OnDone }) {
  if (!item.disputes.length) return <Note>{r.none}</Note>;
  const pending = item.disputes.some(
    (dispute) => dispute.status === 'open' || dispute.status === 'creditor_answered',
  );
  return (
    <div className="grid gap-4">
      <ul className="grid gap-4">
        {item.disputes.map((dispute) => (
          <DisputeCard
            key={dispute.id}
            item={item}
            dispute={dispute}
            canResolve={access.disputes}
            onDone={onDone}
          />
        ))}
      </ul>
      {pending && !access.disputes ? <Note>{d.reserved}</Note> : null}
    </div>
  );
}

/** Historique des étapes (`stageHistory`), le plus récent d'abord. */
export function StageHistory({ item }: { item: Case }) {
  const h = caseDetailTexts.history;
  if (!item.stageHistory.length) return null;
  const rows = [...item.stageHistory].reverse();
  return (
    <ResponsiveTable
      caption={h.caption}
      rows={rows}
      rowKey={(row) => `${row.at}-${row.toStage}`}
      columns={[
        { key: 'to', header: h.to, primary: true, cell: (row) => stageLabel(row.toStage) },
        { key: 'from', header: h.from, cell: (row) => (row.fromStage ? stageLabel(row.fromStage) : h.start) },
        { key: 'at', header: h.at, cell: (row) => formatDateTime(row.at) },
        { key: 'by', header: h.by, cell: (row) => actorName(row.by) },
        { key: 'reason', header: h.reason, cell: (row) => row.reason ?? '' },
      ]}
    />
  );
}
