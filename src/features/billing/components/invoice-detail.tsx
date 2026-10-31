'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText, useSession } from '@/lib/api';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { isModuleVisible } from '@/lib/navigation/visible-modules';
import { useResource } from '@/lib/use-resource';
import { organizationPaths } from '@/features/identity/organizations';
import { paymentAccess, paymentPaths } from '@/features/payment';
import { getInvoice, MANUAL_METHODS, type ManualMethod, recordInvoicePayment } from '@/features/billing/api';
import { isNotFound, isStale, paymentErrorText } from '@/features/billing/errors';
import type { Invoice, InvoicePayment } from '@/features/billing/schemas';
import { billingPaths, billingTexts, invoiceMethod, invoiceSource } from '@/features/billing/texts';
import { formatPeriod, InvoiceStatusBadge, useBillingAccess } from './parts';

const t = billingTexts.invoice;
const pay = billingTexts.pay;
const common = billingTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };
/** Factures qui attendent encore un règlement (l'état vient de la gateway). */
const PAYABLE = ['pending_payment', 'overdue'];

/** Contrat d'origine : pour le Nettoyage, la mission (adresse fixée par la fonctionnalité cleaning). */
const SOURCE_PATHS: Record<string, (id: string) => string> = {
  cleaning: (id) => `/nettoyage/missions/${encodeURIComponent(id)}`,
};

type Line = Invoice['lines'][number];

const lineColumns: TableColumn<Line & { key: string }>[] = [
  { key: 'label', header: t.line, primary: true, cell: (line) => line.label },
  {
    key: 'quantity',
    header: t.quantity,
    className: 'tabular-nums md:text-right',
    cell: (line) => line.quantity,
  },
  {
    key: 'unitPrice',
    header: t.unitPrice,
    className: 'tabular-nums md:text-right',
    cell: (line) => formatXof(line.unitPrice),
  },
  {
    key: 'amount',
    header: t.amount,
    className: 'tabular-nums md:text-right font-semibold',
    cell: (line) => formatXof(line.amount),
  },
];

const paymentColumns: TableColumn<InvoicePayment>[] = [
  {
    key: 'amount',
    header: t.columns.amount,
    primary: true,
    className: 'tabular-nums',
    cell: (payment) => formatXof(payment.amount),
  },
  { key: 'date', header: t.columns.date, cell: (payment) => formatDateTime(payment.recordedAt) },
  { key: 'method', header: t.columns.method, cell: (payment) => invoiceMethod(payment.method) },
  { key: 'reference', header: t.columns.reference, cell: (payment) => payment.reference || t.noReference },
  {
    key: 'by',
    header: t.columns.by,
    cell: (payment) => (payment.recordedBy === 'system' ? t.bySystem : t.byStaff),
  },
];

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

function PaymentDialog({
  invoice,
  onDone,
  onStale,
}: {
  invoice: Invoice;
  onDone: (invoice: Invoice, amount: number) => void;
  onStale: () => void;
}) {
  const balance = formatXof(invoice.balance);
  return (
    <ConfirmAction
      label={pay.label}
      variant="primary"
      title={pay.title}
      description={pay.text(balance)}
      confirmLabel={pay.confirm}
      labels={dialog}
      onConfirm={async (data) => {
        const raw = field(data, 'amount');
        if (!/^\d+$/.test(raw) || Number(raw) < 1) return pay.invalidAmount;
        const method = field(data, 'method') as ManualMethod;
        const reference = field(data, 'reference');
        try {
          const updated = await recordInvoicePayment(invoice.id, {
            amount: Number(raw),
            method: MANUAL_METHODS.includes(method) ? method : 'cash',
            ...(reference ? { reference } : {}),
          });
          onDone(updated, Number(raw));
          return null;
        } catch (error) {
          if (isStale(error)) onStale();
          return paymentErrorText(error, balance);
        }
      }}
    >
      <TextField
        id="facture-paiement-montant"
        name="amount"
        label={pay.amount}
        hint={pay.amountHint}
        inputMode="numeric"
        defaultValue={String(invoice.balance.amount)}
        required
      />
      <SelectField id="facture-paiement-moyen" name="method" label={pay.method} defaultValue="bank_transfer">
        {MANUAL_METHODS.map((method) => (
          <option key={method} value={method}>
            {invoiceMethod(method)}
          </option>
        ))}
      </SelectField>
      <TextField
        id="facture-paiement-reference"
        name="reference"
        label={pay.reference}
        hint={pay.referenceHint}
        maxLength={100}
      />
    </ConfirmAction>
  );
}

function Notice({ invoice }: { invoice: Invoice }) {
  if (invoice.status === 'overdue') return <FormMessage>{t.overdue}</FormMessage>;
  if (invoice.status === 'pending_payment') {
    return <FormMessage tone="info">{t.pending(formatDate(invoice.dueAt))}</FormMessage>;
  }
  if (invoice.status === 'cancelled') return <FormMessage tone="info">{t.cancelled}</FormMessage>;
  return null;
}

function InvoiceView({
  invoice,
  onChange,
  onStale,
}: {
  invoice: Invoice;
  onChange: (invoice: Invoice) => void;
  onStale: () => void;
}) {
  const access = useBillingAccess();
  const roles = useSession()?.roles ?? [];
  const [done, setDone] = useState<string | null>(null);
  const sourcePath = SOURCE_PATHS[invoice.source];
  const canPay = !!access?.invoices && PAYABLE.includes(invoice.status) && invoice.balance.amount > 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={billingPaths.invoices}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2" className="tabular-nums">
            {t.title(invoice.number)}
          </Heading>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="text-ink-muted">
          {t.month(invoice.periodIndex)} · {formatPeriod(invoice.periodStart, invoice.periodEnd)}
        </p>
      </div>

      <Notice invoice={invoice} />
      <FormMessage tone="info">{done}</FormMessage>

      {canPay ? (
        <div className="flex flex-wrap gap-3">
          <PaymentDialog
            invoice={invoice}
            onStale={onStale}
            onDone={(updated, amount) => {
              setDone(pay.done(formatXof(amount)));
              onChange(updated);
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.summaryTitle} id="facture-montants">
          <DescriptionList
            items={[
              { term: t.total, value: <span className="tabular-nums">{formatXof(invoice.total)}</span> },
              { term: t.paid, value: <span className="tabular-nums">{formatXof(invoice.paid)}</span> },
              {
                term: t.balance,
                value: <span className="font-semibold tabular-nums">{formatXof(invoice.balance)}</span>,
              },
              { term: t.issuedAt, value: formatDate(invoice.issuedAt) },
              { term: t.dueAt, value: formatDate(invoice.dueAt) },
              { term: t.paidAt, value: invoice.paidAt ? formatDate(invoice.paidAt) : null },
              { term: t.source, value: invoiceSource(invoice.source) },
              {
                term: t.contract,
                value:
                  sourcePath && isModuleVisible('nettoyage', roles) ? (
                    <Link
                      href={sourcePath(invoice.contractId)}
                      className="text-accent-ink font-semibold underline"
                    >
                      {t.seeMission}
                    </Link>
                  ) : null,
              },
            ]}
          />
        </Panel>

        <Panel title={t.billedTo} id="facture-entete">
          {invoice.organization ? (
            <>
              <address className="text-ink grid gap-1 not-italic">
                <span className="font-semibold">{invoice.organization.legalName}</span>
                <span>{invoice.organization.address}</span>
                <span className="text-small tabular-nums">
                  {t.ifu} : {invoice.organization.ifu}
                  {invoice.organization.rccm ? ` · ${t.rccm} : ${invoice.organization.rccm}` : ''}
                </span>
              </address>
              <p className="text-small text-ink-muted">{t.headerFrozen}</p>
            </>
          ) : (
            <p className="text-small text-ink-muted">{t.noHeader}</p>
          )}
          {invoice.organizationId && isModuleVisible('clients', roles) ? (
            <Link
              href={organizationPaths.organization(invoice.organizationId)}
              className="text-accent-ink justify-self-start font-semibold underline"
            >
              {t.seeOrganization}
            </Link>
          ) : null}
        </Panel>
      </div>

      <Panel title={t.linesTitle} id="facture-lignes">
        <ResponsiveTable
          caption={t.linesCaption}
          columns={lineColumns}
          rows={invoice.lines.map((line, index) => ({ ...line, key: `${index}` }))}
          rowKey={(line) => line.key}
        />
        <p className="text-small text-ink-muted">{t.prorata}</p>
      </Panel>

      <Panel
        title={t.paymentsTitle}
        id="facture-reglements"
        action={
          paymentAccess(roles).list ? (
            <Link
              href={paymentPaths.forSubject(invoice.id)}
              className="text-accent-ink text-small inline-flex min-h-11 items-center font-semibold underline"
            >
              {t.onlinePayments}
            </Link>
          ) : null
        }
      >
        {invoice.payments.length ? (
          <ResponsiveTable
            caption={t.paymentsCaption}
            columns={paymentColumns}
            rows={invoice.payments}
            rowKey={(payment) => payment.id}
          />
        ) : (
          <p className="text-small text-ink-muted">{t.noPayments}</p>
        )}
      </Panel>
    </div>
  );
}

/** Fiche d'une facture : montants, échéance, en-tête, lignes au prorata, règlements, paiement manuel. */
export function InvoiceDetail({ id }: { id: string }) {
  const resource = useResource(useCallback(() => getInvoice(id), [id]));
  return (
    <ResourceView
      resource={resource}
      lines={6}
      labels={common}
      describe={(error) => (isNotFound(error) ? t.notFound : apiErrorText(error))}
      retryable={(error) => !isNotFound(error)}
    >
      {(invoice) => <InvoiceView invoice={invoice} onChange={resource.set} onStale={resource.refresh} />}
    </ResourceView>
  );
}
