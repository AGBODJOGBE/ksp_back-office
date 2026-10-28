'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { listRequests } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestsTexts as t } from '@/features/cleaning/request-texts';
import type { QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts, customerKind, requestStatuses } from '@/features/cleaning/texts';
import { Note, StatusBadge, useCleaningAccess } from './parts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const KINDS = ['individual', 'business'];

const columns = (serviceName: (code: string) => string): TableColumn<QuoteRequest>[] => [
  {
    key: 'request',
    header: t.columns.request,
    primary: true,
    cell: (request) => (
      <Link href={cleaningPaths.request(request.id)} className="stretched-link hover:underline">
        {t.open(formatDateTime(request.createdAt))}
        <span className="text-small text-ink-muted block font-normal">
          {serviceName(request.serviceCode)}
        </span>
      </Link>
    ),
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (request) => <StatusBadge map={requestStatuses} code={request.status} />,
  },
  { key: 'customer', header: t.columns.customer, cell: (request) => customerKind(request.customerKind) },
  { key: 'commune', header: t.columns.commune, cell: (request) => request.commune },
  {
    key: 'estimate',
    header: t.columns.estimate,
    className: 'tabular-nums',
    cell: (request) =>
      request.quote
        ? formatXof(request.quote.total)
        : request.estimate
          ? `${formatXof(request.estimate.low)} – ${formatXof(request.estimate.high)}`
          : t.noEstimate,
  },
];

/** Filtres de la liste, dans l'adresse (`?etat=&commune=&client=`) : partageables et conservés au retour. */
function useFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const read = (name: string) => params.get(name) ?? '';
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return { status: read('etat'), commune: read('commune'), kind: read('client'), set };
}

type Filters = ReturnType<typeof useFilters>;

function FilterBar({ filters, communes }: { filters: Filters; communes: string[] }) {
  const options = [...new Set([...communes, ...(filters.commune ? [filters.commune] : [])])];
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SelectField
          id="filtre-etat"
          className="col-span-2 sm:col-span-1"
          label={t.statusFilter}
          value={filters.status}
          onChange={(event) => filters.set('etat', event.target.value)}
        >
          <option value="">{common.all}</option>
          {Object.entries(requestStatuses).map(([code, status]) => (
            <option key={code} value={code}>
              {status.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-commune"
          label={t.communeFilter}
          value={filters.commune}
          onChange={(event) => filters.set('commune', event.target.value)}
        >
          <option value="">{common.allFeminine}</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-client"
          label={t.kindFilter}
          value={filters.kind}
          onChange={(event) => filters.set('client', event.target.value)}
        >
          <option value="">{common.all}</option>
          {KINDS.map((code) => (
            <option key={code} value={code}>
              {customerKind(code)}
            </option>
          ))}
        </SelectField>
      </div>
      {filters.commune || filters.kind ? <Note>{t.localFilterNote}</Note> : null}
    </div>
  );
}

/** Une liste par état demandé à la gateway ; commune et type de client filtrent les pages chargées. */
function Requests({ filters }: { filters: Filters }) {
  const { status, commune, kind } = filters;
  const load = useCallback((cursor?: string) => listRequests(status || undefined, cursor), [status]);
  const list = usePagedList(load, errorText);
  const serviceName = useServiceName();
  const rows = list.items.filter(
    (request) => (!commune || request.commune === commune) && (!kind || request.customerKind === kind),
  );
  const communes = [...new Set(list.items.map((request) => request.commune))].sort();
  return (
    <div className="grid gap-5">
      <FilterBar filters={filters} communes={communes} />
      <PagedListState list={{ ...list, items: rows }} empty={<Note>{t.empty}</Note>} labels={common}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns(serviceName)}
          rows={rows}
          rowKey={(request) => request.id}
        />
      </PagedListState>
    </div>
  );
}

/** Liste des demandes de devis, filtrable par état (gateway), commune et type de client (pages chargées). */
export function RequestsList() {
  const access = useCleaningAccess();
  const filters = useFilters();
  if (access && !access.supervise) {
    return (
      <Note>
        {t.supervisorsOnly}{' '}
        <Link href={cleaningPaths.missions} className="text-accent-ink font-semibold underline">
          {cleaningTexts.tabs.missions}
        </Link>
      </Note>
    );
  }
  // Une clé par état : la liste repart de la première page.
  return <Requests key={filters.status || 'all'} filters={filters} />;
}
