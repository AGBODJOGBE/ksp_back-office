import { DescriptionList } from '@/components/ui/description-list';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { caseDetailTexts } from '@/features/recovery/case-detail-texts';
import type { AdminCase, Case, Debtor } from '@/features/recovery/case-schemas';
import { closureLabel, debtorRoleLabel, natureLabel, rejectionLabel } from '@/features/recovery/case-texts';
import { actorName, deadlineLabel, kindLabel } from '@/features/recovery/texts';
import { Panel } from './parts';

const t = caseDetailTexts;
/** Jour `AAAA-MM-JJ` lu à midi au Bénin (pas de décalage de date). */
const day = (value: string) => formatDate(`${value}T12:00:00+01:00`);
const money = (value: { amount: number; currency: string }) => (
  <span className="tabular-nums">{formatXof(value)}</span>
);

/** Synthèse : créancier, nature, chargé, score, échéances, commission figée, décision d'examen. */
export function CaseSynthesis({ detail }: { detail: AdminCase }) {
  const item = detail.case;
  const s = t.summary;
  return (
    <Panel title={s.title} id="dossier-synthese">
      <DescriptionList
        items={[
          { term: s.nature, value: natureLabel(item.nature) },
          { term: s.kind, value: kindLabel(item.kind) },
          { term: s.agent, value: item.assignedAgent ? actorName(item.assignedAgent) : s.unassigned },
          { term: s.score, value: item.score === null ? s.scorePending : s.scoreValue(item.score) },
          {
            term: s.deadline,
            value: item.nextDeadline
              ? s.deadlineValue(
                  deadlineLabel(item.nextDeadline.kind),
                  formatDateTime(item.nextDeadline.dueAt),
                )
              : null,
          },
          { term: s.prescription, value: item.prescriptionDate ? day(item.prescriptionDate) : null },
          { term: s.commission, value: item.pricing?.commissionSummary ?? null },
          { term: s.injunction, value: detail.injunctionEligible ? s.injunctionYes : s.injunctionNo },
          { term: s.submitted, value: item.submittedAt ? formatDateTime(item.submittedAt) : null },
          { term: s.accepted, value: item.acceptedAt ? formatDateTime(item.acceptedAt) : null },
          { term: s.reviewNote, value: item.reviewNote },
          { term: s.rejection, value: item.rejectionReason ? rejectionLabel(item.rejectionReason) : null },
          {
            term: s.closure,
            value: item.closure
              ? s.closureValue(closureLabel(item.closure.reason), formatDateTime(item.closure.closedAt))
              : null,
          },
        ]}
      />
      {detail.scoreFactors.length ? (
        <details className="grid gap-3">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{s.scoreDetail}</summary>
          <ResponsiveTable
            caption={s.scoreCaption}
            rows={detail.scoreFactors}
            rowKey={(row) => row.criterion}
            columns={[
              { key: 'criterion', header: s.criterion, primary: true, cell: (row) => row.criterion },
              { key: 'value', header: s.value, cell: (row) => row.value },
              {
                key: 'points',
                header: s.points,
                cell: (row) => <span className="tabular-nums">{row.points}</span>,
              },
            ]}
          />
        </details>
      ) : null}
    </Panel>
  );
}

/** Montants du dossier (`RecoveryCaseAmounts`), en F CFA entiers. */
export function CaseAmounts({ item }: { item: Case }) {
  const a = t.amounts;
  const { amounts } = item;
  return (
    <Panel title={a.title} id="dossier-montants">
      <DescriptionList
        items={[
          { term: a.principal, value: money(amounts.principal) },
          { term: a.interests, value: money(amounts.interests) },
          { term: a.costs, value: money(amounts.costs) },
          { term: a.paid, value: money(amounts.paid) },
          { term: a.waived, value: money(amounts.waived) },
          { term: a.due, value: <strong className="tabular-nums">{formatXof(amounts.due)}</strong> },
          { term: a.overpaid, value: amounts.overpaid.amount > 0 ? money(amounts.overpaid) : null },
        ]}
      />
    </Panel>
  );
}

function DebtorCard({ debtor }: { debtor: Debtor }) {
  const d = t.debtors;
  const list = (values: string[]) => (values.length ? values.join(', ') : d.none);
  return (
    <li className="border-line grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <p className="font-semibold">
        {debtor.displayName}{' '}
        <span className="text-small text-ink-muted font-normal">· {debtorRoleLabel(debtor.role)}</span>
      </p>
      <DescriptionList
        items={[
          { term: d.representative, value: debtor.representativeName },
          { term: d.phones, value: list(debtor.phones) },
          { term: d.emails, value: list(debtor.emails) },
          { term: d.address, value: debtor.address ?? d.none },
          { term: d.commune, value: debtor.communeKey },
        ]}
      />
    </li>
  );
}

/** Débiteurs et créances : coordonnées affichées seulement parce que le contrat les renvoie. */
export function CaseParties({ item }: { item: Case }) {
  const c = t.claims;
  return (
    <>
      <Panel title={t.debtors.title} id="dossier-debiteurs">
        <ul className="grid gap-4">
          {item.debtors.map((debtor) => (
            <DebtorCard key={debtor.id} debtor={debtor} />
          ))}
        </ul>
      </Panel>
      <Panel title={c.title} id="dossier-creances">
        <ResponsiveTable
          caption={c.caption}
          rows={item.claims}
          rowKey={(row) => row.id}
          columns={[
            { key: 'reference', header: c.reference, primary: true, cell: (row) => row.reference },
            { key: 'amount', header: c.amount, cell: (row) => money(row.amount) },
            { key: 'dueDate', header: c.dueDate, cell: (row) => day(row.dueDate) },
            { key: 'description', header: c.description, cell: (row) => row.description ?? '' },
          ]}
        />
      </Panel>
    </>
  );
}
