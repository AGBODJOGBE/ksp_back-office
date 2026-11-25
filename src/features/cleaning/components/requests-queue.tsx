'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { countRequests, listRequests } from '@/features/cleaning/requests-api';
import {
  hasRequestFilters,
  type RequestFilterValues,
  readRequestFilters,
  requestQuery,
  toApiFilters,
} from '@/features/cleaning/requests-filters';
import type { RequestStatus, RequestSummary } from '@/features/cleaning/requests-schemas';
import {
  ACTION_STATUSES,
  customerKindName,
  nextStep,
  requestStatus,
  requestsTexts,
} from '@/features/cleaning/requests-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { RowLink } from './catalog-parts';
import { RequestsFilterBar } from './requests-filter-bar';
import { ListState, LoadingBlock, Note, useCleaningAccess } from './parts';

const t = requestsTexts.queue;
const c = t.columns;

function Customer({ row }: { row: RequestSummary }) {
  const name = row.customerKind === 'organization' ? row.organizationName : row.customerName;
  return (
    <span className="grid gap-0.5">
      <span className={name ? undefined : 'text-ink-muted'}>{name?.trim() || t.noName}</span>
      <span className="text-small text-ink-muted">{customerKindName(row.customerKind)}</span>
    </span>
  );
}

const columns: TableColumn<RequestSummary>[] = [
  {
    key: 'number',
    header: c.number,
    primary: true,
    cell: (row) => <RowLink href={cleaningPaths.request(row.id)}>{row.number}</RowLink>,
  },
  { key: 'customer', header: c.customer, cell: (row) => <Customer row={row} /> },
  {
    key: 'place',
    header: c.place,
    cell: (row) => (
      <span className="grid gap-0.5">
        <span>{row.placeTypeName}</span>
        <span className="text-small text-ink-muted">{row.communeName}</span>
      </span>
    ),
  },
  { key: 'types', header: c.types, cell: (row) => row.cleaningTypes.map((type) => type.name).join(', ') },
  {
    key: 'status',
    header: c.status,
    cell: (row) => {
      const status = requestStatus(row.status);
      return (
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      );
    },
  },
  {
    key: 'next',
    header: c.next,
    cell: (row) => {
      const step = nextStep(row.status);
      return step.action ? (
        <span className="text-ink font-semibold">{step.label}</span>
      ) : (
        <span className="text-ink-muted">{step.label}</span>
      );
    },
  },
  {
    key: 'nextVisit',
    header: c.nextVisit,
    cell: (row) => (row.nextVisitAt ? formatDateTime(row.nextVisitAt) : t.noVisit),
  },
  { key: 'created', header: c.created, cell: (row) => formatDate(row.createdAt) },
];

/** Compteurs « À traiter » : un par statut qui attend l'équipe ; un clic filtre la file. */
function ToDo({ active, onSelect }: { active: string; onSelect: (status: RequestStatus | '') => void }) {
  const counts = useResource(
    useCallback(() => Promise.all(ACTION_STATUSES.map((status) => countRequests(status))), []),
  );
  const values = counts.state.status === 'ready' ? counts.state.data : null;
  return (
    <section aria-labelledby="dossiers-a-traiter" className="grid gap-2">
      <h2 id="dossiers-a-traiter" className="text-ink font-semibold">
        {t.toDo}
      </h2>
      <p className="text-small text-ink-muted">{t.toDoHint}</p>
      <div className="flex flex-wrap gap-2">
        {ACTION_STATUSES.map((status, index) => {
          const selected = active === status;
          return (
            <Button
              key={status}
              variant={selected ? 'action' : 'secondary'}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? '' : status)}
            >
              <span>{requestStatus(status).label}</span>
              <span className={cn('tabular-nums', selected ? undefined : 'text-ink-muted')}>
                {values ? values[index] : t.countUnknown}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/** Liste des dossiers d'un jeu de filtres ; remontée à chaque changement de filtres (`key`). */
function RequestsTable({ values }: { values: RequestFilterValues }) {
  const [total, setTotal] = useState<number | null>(null);
  const filters = useMemo(() => toApiFilters(values), [values]);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listRequests(filters)(cursor);
      setTotal(page.total);
      return page;
    },
    [filters],
  );
  const list = usePagedList(load, loadErrorText);
  const empty = hasRequestFilters(values) ? t.empty : t.emptyAll;
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : total > 1 ? `${total} dossiers` : `${total} dossier`}
      </p>
      <ListState list={list} empty={<Note>{empty}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(row) => row.id} />
      </ListState>
    </div>
  );
}

/** File des dossiers (`/nettoyage`) : à traiter, filtres dans l'adresse, liste paginée. */
export function RequestsQueue() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readRequestFilters(new URLSearchParams(query)), [query]);

  if (!access) return <LoadingBlock lines={6} />;
  if (!access['cleaning.request.read']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<RequestFilterValues>) => {
    const next = requestQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <ToDo active={values.status} onSelect={(status) => update({ status })} />
      <RequestsFilterBar values={values} onChange={update} />
      {values.customerId ? <Note>{t.customerFilter}</Note> : null}
      {values.organizationId ? <Note>{t.organizationFilter}</Note> : null}
      {hasRequestFilters(values) ? (
        <Button variant="ghost" className="justify-self-start" onClick={() => router.replace(pathname)}>
          {t.clear}
        </Button>
      ) : null}
      <RequestsTable key={toQueryKey(values)} values={values} />
    </div>
  );
}

const toQueryKey = (values: RequestFilterValues) => JSON.stringify(values);
