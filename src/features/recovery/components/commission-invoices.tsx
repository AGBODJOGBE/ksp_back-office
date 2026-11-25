'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { loadErrorText } from '@/features/recovery/errors';
import {
  COMMISSION_INVOICE_STATUSES,
  type CommissionInvoice,
  type CommissionInvoiceStatus,
} from '@/features/recovery/invoice-schemas';
import { failureLabel, invoiceStatus, invoiceTexts, periodLabel } from '@/features/recovery/invoice-texts';
import { listCommissionInvoices } from '@/features/recovery/invoices-api';
import { recoveryPaths } from '@/features/recovery/paths';
import { ListState, Note } from './parts';

const t = invoiceTexts.list;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARAMS = { status: 'etat', period: 'mois', creditorId: 'creancier' } as const;

/** Créancier d'une facture : raison sociale de l'organisation, ou mention du compte. */
export function creditorName(invoice: CommissionInvoice): string {
  return invoice.organization?.legalName ?? invoiceTexts.creditor.account;
}

/** État d'une facture, avec l'échec du débit automatique quand il y en a un. */
export function InvoiceStatus({ invoice }: { invoice: CommissionInvoice }) {
  const badge = invoiceStatus(invoice.status);
  const failure = invoice.status === 'pending_payment' ? invoice.debit?.lastFailure : null;
  return (
    <span className="grid justify-items-start gap-1">
      <Badge tone={badge.tone} dot>
        {badge.label}
      </Badge>
      {failure ? (
        <span className="text-small text-danger">{t.debitFailed(failureLabel(failure))}</span>
      ) : null}
    </span>
  );
}

const amount = (value: { amount: number; currency: string }) => (
  <span className="tabular-nums">{formatXof(value)}</span>
);

const columns: TableColumn<CommissionInvoice>[] = [
  {
    key: 'number',
    header: t.columns.number,
    primary: true,
    cell: (invoice) => (
      <Link
        href={recoveryPaths.invoice(invoice.id)}
        className="text-accent-ink stretched-link underline-offset-4 hover:underline"
      >
        {invoice.number}
      </Link>
    ),
  },
  { key: 'creditor', header: t.columns.creditor, cell: creditorName },
  { key: 'period', header: t.columns.period, cell: (invoice) => periodLabel(invoice.period) },
  { key: 'collected', header: t.columns.collected, cell: (invoice) => amount(invoice.totalCollected) },
  { key: 'commission', header: t.columns.commission, cell: (invoice) => amount(invoice.commissionTotal) },
  { key: 'balance', header: t.columns.balance, cell: (invoice) => amount(invoice.balance) },
  { key: 'status', header: t.columns.status, cell: (invoice) => <InvoiceStatus invoice={invoice} /> },
];

/** Factures de commission (`GET /billing/commission-invoices`), filtrées dans l'adresse. */
export function CommissionInvoicesList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawStatus = params.get(PARAMS.status) ?? '';
  const status = (COMMISSION_INVOICE_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as CommissionInvoiceStatus)
    : undefined;
  const rawPeriod = params.get(PARAMS.period) ?? '';
  const period = PERIOD.test(rawPeriod) ? rawPeriod : undefined;
  const rawCreditor = params.get(PARAMS.creditorId) ?? '';
  const creditorId = UUID.test(rawCreditor) ? rawCreditor : undefined;
  const load = useMemo(
    () => listCommissionInvoices({ status, period, creditorId }),
    [status, period, creditorId],
  );
  const list = usePagedList(load, loadErrorText);

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField
          id="factures-etat"
          label={t.status}
          value={status ?? ''}
          onChange={(event) => setParam(PARAMS.status, event.target.value)}
        >
          <option value="">{t.all}</option>
          {COMMISSION_INVOICE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {invoiceStatus(value).label}
            </option>
          ))}
        </SelectField>
        <TextField
          id="factures-mois"
          type="month"
          label={t.period}
          hint={t.periodHint}
          value={period ?? ''}
          onChange={(event) =>
            setParam(PARAMS.period, PERIOD.test(event.target.value) ? event.target.value : '')
          }
        />
      </div>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns}
          rows={list.items}
          rowKey={(invoice) => invoice.id}
        />
      </ListState>
    </div>
  );
}
