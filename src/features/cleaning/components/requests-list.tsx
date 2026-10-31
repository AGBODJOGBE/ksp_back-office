'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { listRequests, listZoneOptions, type ZoneOption } from '@/features/cleaning/api';
import { errorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestsTexts as t } from '@/features/cleaning/request-texts';
import type { QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts, customerKind, customerLabel, requestStatuses } from '@/features/cleaning/texts';
import { Note, StatusBadge, useCleaningAccess } from './parts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const KINDS = ['individual', 'business'];
/** Format du code de zone accepté par la gateway (paramètre `commune`). */
const ZONE_CODE = /^[a-z][a-z0-9-]{1,99}$/;

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
  {
    key: 'customer',
    header: t.columns.customer,
    cell: (request) => (
      <span className="grid">
        <span>{customerLabel(request)}</span>
        <span className="text-small text-ink-muted">{customerKind(request.customerKind)}</span>
      </span>
    ),
  },
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

/**
 * Filtres de la liste, dans l'adresse (`?etat=&commune=&client=`) : partageables et conservés au retour.
 * `commune` porte le code de zone (`abomey-calavi`), comme le paramètre de la gateway.
 */
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
  // Une ancienne adresse portait le nom de la commune : seul un code de zone est transmis à la gateway.
  const commune = read('commune');
  return { status: read('etat'), commune: ZONE_CODE.test(commune) ? commune : '', kind: read('client'), set };
}

type Filters = ReturnType<typeof useFilters>;

/**
 * Zones du filtre de commune, lues une fois les droits connus (`null` : session pas encore reprise). Un
 * échec laisse le filtre avec la seule valeur de l'adresse.
 */
function useZoneOptions(includeInactive: boolean | null): ZoneOption[] {
  const [zones, setZones] = useState<ZoneOption[]>([]);
  useEffect(() => {
    if (includeInactive === null) return;
    let live = true;
    listZoneOptions(includeInactive).then(
      (data) => {
        if (live) setZones([...data].sort((a, b) => a.commune.localeCompare(b.commune, 'fr')));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [includeInactive]);
  return zones;
}

function FilterBar({ filters, zones }: { filters: Filters; zones: ZoneOption[] }) {
  const options =
    filters.commune && !zones.some((zone) => zone.code === filters.commune)
      ? [...zones, { code: filters.commune, commune: filters.commune }]
      : zones;
  return (
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
        {options.map((zone) => (
          <option key={zone.code} value={zone.code}>
            {zone.commune}
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
  );
}

/** Une liste par combinaison de filtres, tous appliqués par la gateway (pagination par curseur). */
function Requests({ status, commune, kind }: { status: string; commune: string; kind: string }) {
  const load = useCallback(
    (cursor?: string) =>
      listRequests(
        { status: status || undefined, commune: commune || undefined, customerKind: kind || undefined },
        cursor,
      ),
    [status, commune, kind],
  );
  const list = usePagedList(load, errorText);
  const serviceName = useServiceName();
  return (
    <PagedListState list={list} empty={<Note>{t.empty}</Note>} labels={common}>
      <ResponsiveTable
        caption={t.caption}
        columns={columns(serviceName)}
        rows={list.items}
        rowKey={(request) => request.id}
      />
    </PagedListState>
  );
}

/** Liste des demandes de devis, filtrable par état, commune et type de client (gateway). */
export function RequestsList() {
  const access = useCleaningAccess();
  const filters = useFilters();
  const zones = useZoneOptions(access ? access.administer : null);
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
  const { status, commune, kind } = filters;
  return (
    <div className="grid gap-5">
      <FilterBar filters={filters} zones={zones} />
      {/* Une clé par combinaison de filtres : la liste repart de la première page. */}
      <Requests key={`${status}|${commune}|${kind}`} status={status} commune={commune} kind={kind} />
    </div>
  );
}
