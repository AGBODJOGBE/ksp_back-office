'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { apiErrorText, useSession } from '@/lib/api';
import { usePagedList } from '@/lib/use-paged-list';
import { type CreditNoteFilters, listCreditNotes } from '@/features/billing/api';
import { creditNoteTexts } from '@/features/billing/credit-note-texts';
import { creditNoteColumns } from './credit-notes-panel';
import { useBillingAccess } from './parts';

const l = creditNoteTexts.list;

/** Filtres de l'adresse (en français) → filtres du contrat. */
const PARAMS = [
  { param: 'facture', filter: 'invoiceId', label: l.byInvoice },
  { param: 'client', filter: 'customerId', label: l.byCustomer },
  { param: 'entreprise', filter: 'organizationId', label: l.byOrganization },
] as const;

function Notes({ filters, me }: { filters: CreditNoteFilters; me?: string }) {
  const { invoiceId, customerId, organizationId } = filters;
  const load = useCallback(
    (cursor?: string) => listCreditNotes({ invoiceId, customerId, organizationId }, cursor),
    [invoiceId, customerId, organizationId],
  );
  const list = usePagedList(load, apiErrorText);
  const filtered = Boolean(invoiceId || customerId || organizationId);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{filtered ? l.emptyFiltered : l.empty}</p>}
      labels={creditNoteTexts}
    >
      <ResponsiveTable
        caption={l.caption}
        columns={creditNoteColumns({ withInvoice: true, me })}
        rows={list.items}
        rowKey={(note) => note.id}
      />
    </PagedListState>
  );
}

/**
 * Avoirs émis (R-PE-07), les plus récents d'abord, filtrables par facture, client ou entreprise dans
 * l'adresse (`?facture=`, `?client=`, `?entreprise=`). Un avoir s'émet depuis la fiche de sa facture.
 */
export function CreditNotesList() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const access = useBillingAccess();
  const me = useSession()?.user.id;
  if (access && !access.creditNotes) return <FormMessage tone="info">{l.forbidden}</FormMessage>;

  const filters: CreditNoteFilters = {};
  const active = PARAMS.filter(({ param, filter }) => {
    const value = params.get(param);
    if (value) filters[filter] = value;
    return Boolean(value);
  });

  function remove(param: string) {
    const next = new URLSearchParams(params.toString());
    next.delete(param);
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="grid gap-5">
      {active.length ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={l.filters}>
          {active.map(({ param, label }) => (
            <Button key={param} variant="secondary" onClick={() => remove(param)}>
              {l.removeFilter(label)}
            </Button>
          ))}
        </div>
      ) : null}
      <Notes key={params.toString()} filters={filters} me={me} />
    </div>
  );
}
