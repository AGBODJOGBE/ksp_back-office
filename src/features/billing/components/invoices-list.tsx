'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { IconClose } from '@/components/ui/icons';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { apiErrorText } from '@/lib/api';
import { formatDate, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { type InvoiceFilters, INVOICE_STATUSES, listInvoices } from '@/features/billing/api';
import type { Invoice } from '@/features/billing/schemas';
import { billingPaths, billingTexts, invoiceStatus } from '@/features/billing/texts';
import { formatPeriod, InvoiceStatusBadge } from './parts';

const t = billingTexts.invoices;
const common = billingTexts.common;

/** Paramètres de l'adresse (en français) → filtres de la gateway. */
const PARAMS = { status: 'etat', organizationId: 'entreprise', contractId: 'mission' } as const;
type FilterKey = keyof typeof PARAMS;

function billedTo(invoice: Invoice): string {
  if (invoice.organization) return invoice.organization.legalName;
  return invoice.organizationId ? t.unknownHeader : t.individual;
}

const columns: TableColumn<Invoice>[] = [
  {
    key: 'number',
    header: t.columns.number,
    primary: true,
    cell: (invoice) => (
      <Link href={billingPaths.invoice(invoice.id)} className="stretched-link tabular-nums hover:underline">
        {invoice.number}
      </Link>
    ),
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
  },
  { key: 'billedTo', header: t.columns.billedTo, cell: billedTo },
  {
    key: 'period',
    header: t.columns.period,
    cell: (invoice) => (
      <span className="grid">
        <span>{t.month(invoice.periodIndex)}</span>
        <span className="text-small text-ink-muted">
          {formatPeriod(invoice.periodStart, invoice.periodEnd)}
        </span>
      </span>
    ),
  },
  { key: 'dueAt', header: t.columns.dueAt, cell: (invoice) => formatDate(invoice.dueAt) },
  {
    key: 'total',
    header: t.columns.total,
    className: 'tabular-nums',
    cell: (invoice) => formatXof(invoice.total),
  },
  {
    key: 'balance',
    header: t.columns.balance,
    className: 'tabular-nums font-semibold',
    cell: (invoice) => formatXof(invoice.balance),
  },
];

function Invoices({ filters, filtered }: { filters: InvoiceFilters; filtered: boolean }) {
  const { status, organizationId, contractId } = filters;
  const load = useCallback(
    (cursor?: string) => listInvoices({ status, organizationId, contractId }, cursor),
    [status, organizationId, contractId],
  );
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{filtered ? t.emptyFiltered : t.empty}</p>}
      labels={common}
    >
      <ResponsiveTable
        caption={t.caption}
        columns={columns}
        rows={list.items}
        rowKey={(invoice) => invoice.id}
      />
    </PagedListState>
  );
}

/**
 * Factures, filtrées dans l'adresse : `?etat=` (état), `?entreprise=` (organisation, depuis la fiche
 * d'un compte entreprise) et `?mission=` (contrat du Nettoyage). Tous passés tels quels à la gateway.
 */
export function InvoicesList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const read = (key: FilterKey) => params.get(PARAMS[key]) || undefined;
  const filters: InvoiceFilters = {
    status: read('status'),
    organizationId: read('organizationId'),
    contractId: read('contractId'),
  };

  function update(key: FilterKey, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(PARAMS[key], value);
    else next.delete(PARAMS[key]);
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const chips = [
    filters.organizationId ? { key: 'organizationId' as const, label: t.byOrganization } : null,
    filters.contractId ? { key: 'contractId' as const, label: t.byContract } : null,
  ].filter((chip) => chip !== null);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          id="filtre-etat-facture"
          label={t.status}
          value={filters.status ?? ''}
          className="w-full sm:max-w-xs"
          onChange={(event) => update('status', event.target.value)}
        >
          <option value="">{common.all}</option>
          {INVOICE_STATUSES.map((code) => (
            <option key={code} value={code}>
              {invoiceStatus(code).label}
            </option>
          ))}
        </SelectField>
        {chips.length ? (
          <ul aria-label={t.filters} className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <Button
                  variant="secondary"
                  onClick={() => update(chip.key, '')}
                  aria-label={t.removeFilter(chip.label)}
                >
                  {chip.label}
                  <IconClose className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Invoices
        key={`${filters.status}-${filters.organizationId}-${filters.contractId}`}
        filters={filters}
        filtered={!!(filters.status || filters.organizationId || filters.contractId)}
      />
    </div>
  );
}
