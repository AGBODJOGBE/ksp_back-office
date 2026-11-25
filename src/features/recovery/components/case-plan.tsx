'use client';

import { Badge } from '@/components/ui/badge';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { TextAreaField } from '@/components/ui/select-field';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import type { RecoveryAccess } from '@/features/recovery/access';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import type { Case, PaymentPlan, PlanScale } from '@/features/recovery/case-schemas';
import {
  installmentStatusLabel,
  planStatusLabel,
  promiseStatusLabel,
  rhythmLabel,
  violationLabel,
} from '@/features/recovery/case-texts';
import { decidePlan } from '@/features/recovery/cases-api';
import { attempt } from '@/features/recovery/errors';
import { actorName, formatBps, recoveryTexts } from '@/features/recovery/texts';
import { confirmLabels, field, type OnDone } from './case-action-parts';
import { Note } from './parts';

const t = caseDetailTexts.plan;
const p = caseActionTexts.plan;
const c = recoveryTexts.common;
const day = (value: string) => formatDate(`${value}T12:00:00+01:00`);
const money = (value: { amount: number; currency: string }) => (
  <span className="tabular-nums">{formatXof(value)}</span>
);

/** Barème du créancier figé sur le dossier (`RecoveryPlanScale`). */
export function ScaleSummary({ scale }: { scale: PlanScale }) {
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t.scale}</summary>
      <DescriptionList
        className="mt-3"
        items={[
          { term: t.scaleAccepts, value: scale.acceptsPaymentPlan ? c.yes : c.no },
          { term: t.scaleDuration, value: t.scaleMonths(scale.maxDurationMonths) },
          { term: t.scaleFirst, value: formatBps(scale.minFirstPaymentBps) },
          { term: t.scaleFirstDays, value: t.scaleDays(scale.firstPaymentWithinDays) },
          { term: t.scaleMinimum, value: money(scale.minInstallment) },
          { term: t.scaleDiscount, value: formatBps(scale.maxDiscountBps) },
        ]}
      />
    </details>
  );
}

/** Validation d'un échéancier hors barème : rôle prévu par le contrat ; le service refuse l'auteur. */
function PlanApproval({ plan, onDone }: { plan: PaymentPlan; onDone: OnDone }) {
  const decide = (decision: 'approve' | 'reject', note: string, message: string) =>
    attempt(async () => {
      await decidePlan(plan.id, decision, note);
      onDone(message);
    });
  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmAction
        label={p.approve}
        title={p.approveTitle}
        description={p.approveText}
        confirmLabel={p.approve}
        labels={confirmLabels}
        variant="action"
        onConfirm={(data) => decide('approve', field(data, 'note'), p.approved)}
      >
        <TextAreaField
          id="echeancier-valider-note"
          name="note"
          label={caseActionTexts.noteOptional}
          maxLength={1000}
        />
      </ConfirmAction>
      <ConfirmAction
        label={p.reject}
        title={p.rejectTitle}
        description={p.rejectText}
        confirmLabel={p.reject}
        labels={confirmLabels}
        danger
        onConfirm={(data) => decide('reject', field(data, 'note'), p.refused)}
      >
        <TextAreaField
          id="echeancier-refuser-note"
          name="note"
          label={caseActionTexts.noteOptional}
          maxLength={1000}
        />
      </ConfirmAction>
    </div>
  );
}

/** Échéancier en cours : conditions, barème, échéances ; validation hors barème si elle est attendue. */
export function CurrentPlan({
  item,
  access,
  onDone,
}: {
  item: Case;
  access: RecoveryAccess;
  onDone: OnDone;
}) {
  const plan = item.currentPlan;
  if (!plan) return <Note>{t.none}</Note>;
  const awaitingApproval = plan.status === 'proposed' && !plan.withinScale;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={plan.withinScale ? 'success' : 'warning'} dot>
          {plan.withinScale ? t.withinYes : t.withinNo}
        </Badge>
        <Badge>{planStatusLabel(plan.status)}</Badge>
      </div>
      <DescriptionList
        items={[
          { term: t.first, value: `${formatXof(plan.terms.firstAmount)} — ${day(plan.terms.firstDueDate)}` },
          { term: t.rhythm, value: rhythmLabel(plan.terms.rhythm) },
          { term: t.count, value: String(plan.terms.installmentsCount) },
          { term: t.total, value: money(plan.total) },
          { term: t.proposedBy, value: plan.proposedBy === 'debtor' ? t.debtor : t.agent },
          { term: t.renegotiation, value: plan.renegotiation ? c.yes : null },
          { term: t.missed, value: plan.missedCount ? String(plan.missedCount) : null },
          { term: t.signed, value: plan.signedAt ? formatDateTime(plan.signedAt) : null },
        ]}
      />
      {plan.violations.length ? (
        <ul className="text-small grid list-disc gap-1 pl-5">
          {plan.violations.map((violation) => (
            <li key={violation}>{violationLabel(violation)}</li>
          ))}
        </ul>
      ) : null}
      <ResponsiveTable
        caption={t.caption}
        rows={plan.installments}
        rowKey={(row) => `${row.rank}`}
        columns={[
          { key: 'rank', header: t.rank, primary: true, cell: (row) => `${row.rank}` },
          { key: 'date', header: t.date, cell: (row) => day(row.dueDate) },
          { key: 'amount', header: t.amount, cell: (row) => money(row.amount) },
          { key: 'paid', header: t.paidAmount, cell: (row) => money(row.paidAmount) },
          { key: 'status', header: t.installmentStatus, cell: (row) => installmentStatusLabel(row.status) },
        ]}
      />
      {awaitingApproval && access.assess ? <PlanApproval plan={plan} onDone={onDone} /> : null}
      {awaitingApproval && !access.assess ? <Note>{p.approvalReserved}</Note> : null}
    </div>
  );
}

/** Promesses de paiement enregistrées. */
export function Promises({ item }: { item: Case }) {
  const s = caseDetailTexts.promises;
  if (!item.promises.length) return <Note>{s.none}</Note>;
  return (
    <ResponsiveTable
      caption={s.caption}
      rows={item.promises}
      rowKey={(row) => row.id}
      columns={[
        { key: 'amount', header: s.amount, primary: true, cell: (row) => money(row.amount) },
        { key: 'date', header: s.dueDate, cell: (row) => day(row.dueDate) },
        { key: 'status', header: s.status, cell: (row) => promiseStatusLabel(row.status) },
        { key: 'by', header: s.by, cell: (row) => actorName(row.recordedBy) },
      ]}
    />
  );
}
