'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DescriptionList } from '@/components/ui/description-list';
import { Heading } from '@/components/ui/heading';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import type { CommissionInvoice, CommissionLine } from '@/features/recovery/invoice-schemas';
import {
  failureLabel,
  invoiceTexts,
  periodLabel,
  settlementLabel,
  sourceLabel,
} from '@/features/recovery/invoice-texts';
import { getCommissionInvoice } from '@/features/recovery/invoices-api';
import { recoveryPaths } from '@/features/recovery/paths';
import { InvoiceStatus } from './commission-invoices';
import { BackLink, Note, Panel, ResourceView } from './parts';

const t = invoiceTexts.detail;
const money = (value: { amount: number; currency: string }) => (
  <span className="tabular-nums">{formatXof(value)}</span>
);
/** Jour du calendrier lu à midi au Bénin. */
const day = (date: string) => formatDate(`${date}T12:00:00+01:00`);

const lineColumns: TableColumn<CommissionLine>[] = [
  { key: 'date', header: t.columns.date, primary: true, cell: (line) => day(line.receivedOn) },
  {
    key: 'case',
    header: t.columns.case,
    cell: (line) => (
      <Link
        href={recoveryPaths.case(line.caseId)}
        aria-label={t.openCase(line.caseNumber)}
        className="text-accent-ink font-semibold underline-offset-4 hover:underline"
      >
        {line.caseNumber}
      </Link>
    ),
  },
  { key: 'source', header: t.columns.source, cell: (line) => sourceLabel(line.source) },
  { key: 'gross', header: t.columns.gross, cell: (line) => money(line.gross) },
  { key: 'commission', header: t.columns.commission, cell: (line) => money(line.commission) },
  { key: 'settlement', header: t.columns.settlement, cell: (line) => settlementLabel(line.settlement) },
];

function InvoiceContent({ invoice }: { invoice: CommissionInvoice }) {
  const { debit, organization } = invoice;
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={recoveryPaths.invoices}>{t.back}</BackLink>
        <Heading as="h1" size="h2">
          {t.title(invoice.number)}
        </Heading>
        <InvoiceStatus invoice={invoice} />
        <Note>{t.excludingTax}</Note>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.creditor} id="facture-creancier">
          <DescriptionList
            items={
              organization
                ? [
                    { term: t.legalName, value: organization.legalName },
                    { term: t.address, value: organization.address },
                    { term: t.ifu, value: organization.ifu },
                    { term: t.rccm, value: organization.rccm },
                  ]
                : [
                    {
                      term: t.creditor,
                      value: (
                        <span className="break-all">
                          {invoiceTexts.creditor.accountId(invoice.creditor.id)}
                        </span>
                      ),
                    },
                  ]
            }
          />
          <DescriptionList
            items={[
              { term: t.period, value: periodLabel(invoice.period) },
              { term: t.issuedAt, value: formatDateTime(invoice.issuedAt) },
              { term: t.paidAt, value: invoice.paidAt ? formatDateTime(invoice.paidAt) : null },
            ]}
          />
        </Panel>
        <Panel title={t.totals} id="facture-totaux">
          <DescriptionList
            items={[
              { term: t.totalCollected, value: money(invoice.totalCollected) },
              { term: t.commissionDeducted, value: money(invoice.commissionDeducted) },
              { term: t.commissionInvoiced, value: money(invoice.commissionInvoiced) },
              { term: t.commissionTotal, value: <strong>{formatXof(invoice.commissionTotal)}</strong> },
              { term: t.balance, value: <strong>{formatXof(invoice.balance)}</strong> },
            ]}
          />
        </Panel>
      </div>
      <Panel title={t.debit} id="facture-debit">
        {debit ? (
          <DescriptionList
            items={[
              { term: t.attempts, value: String(debit.attempts) },
              {
                term: t.lastAttemptAt,
                value: debit.lastAttemptAt ? formatDateTime(debit.lastAttemptAt) : null,
              },
              { term: t.lastFailure, value: debit.lastFailure ? failureLabel(debit.lastFailure) : null },
              { term: t.missing, value: debit.missing ? money(debit.missing) : null },
              {
                term: t.nextAttemptAt,
                value: debit.nextAttemptAt ? formatDateTime(debit.nextAttemptAt) : null,
              },
              {
                term: t.walletTransaction,
                value: invoice.walletTransactionId ? (
                  <span className="break-all">{invoice.walletTransactionId}</span>
                ) : null,
              },
            ]}
          />
        ) : (
          <Note>{t.noDebit}</Note>
        )}
      </Panel>
      <Panel title={t.lines} id="facture-lignes">
        {invoice.lines.length ? (
          <ResponsiveTable
            caption={t.linesCaption}
            columns={lineColumns}
            rows={invoice.lines}
            rowKey={(line) => line.collectionId}
          />
        ) : (
          <Note>{t.noLines}</Note>
        )}
      </Panel>
    </div>
  );
}

/** Fiche d'une facture de commission (`GET /billing/commission-invoices/{id}`), en lecture. */
export function CommissionInvoiceDetail({ id }: { id: string }) {
  const load = useCallback(() => getCommissionInvoice(id), [id]);
  const resource = useResource(load);
  return (
    <ResourceView resource={resource} lines={6}>
      {(invoice) => <InvoiceContent invoice={invoice} />}
    </ResourceView>
  );
}
