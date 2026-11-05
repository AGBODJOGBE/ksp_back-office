'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import {
  getServiceNames,
  listPlaceTypeOptions,
  listRequests,
  listZoneOptions,
  type PlaceTypeOption,
  type ZoneOption,
} from '@/features/cleaning/api';
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
/** Format des codes de type de lieu et de prestation (paramètres `placeType` et `serviceCode`). */
const CODE = /^[a-z][a-z0-9_]{1,49}$/;
/** Identifiant de groupe (paramètre `groupId`, UUID). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = (serviceName: (code: string) => string): TableColumn<QuoteRequest>[] => [
  {
    key: 'request',
    header: t.columns.request,
    primary: true,
    cell: (request) => (
      <span className="grid justify-items-start gap-1">
        <Link href={cleaningPaths.request(request.id)} className="stretched-link hover:underline">
          {t.open(formatDateTime(request.createdAt))}
          <span className="text-small text-ink-muted block font-normal">
            {request.serviceName?.trim() || serviceName(request.serviceCode)}
          </span>
        </Link>
        {request.groupId && request.groupSize > 1 ? (
          <Link
            href={cleaningPaths.group(request.groupId)}
            aria-label={t.groupBadgeLabel(request.groupSize)}
            className="bg-brand-soft text-brand-ink ring-brand-muted relative z-10 inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset hover:underline"
          >
            {t.groupBadge(request.groupSize)}
          </Link>
        ) : null}
      </span>
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
  {
    key: 'commune',
    header: t.columns.commune,
    cell: (request) => (
      <span className="grid">
        <span>{request.commune}</span>
        {request.placeTypeLabel ? (
          <span className="text-small text-ink-muted">{request.placeTypeLabel}</span>
        ) : null}
      </span>
    ),
  },
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
 * Filtres de la liste, dans l'adresse (`?etat=&commune=&client=&lieu=&prestation=&groupe=`) : partageables et
 * conservés au retour. `commune` porte le code de zone (`abomey-calavi`), `lieu` le code du type de lieu,
 * `prestation` le code de la prestation et `groupe` l'identifiant du groupe, comme les paramètres de la gateway.
 * Une valeur mal formée est ignorée (jamais transmise).
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
  const valid = (name: string, format: RegExp) => (format.test(read(name)) ? read(name) : '');
  return {
    status: read('etat'),
    commune: ZONE_CODE.test(commune) ? commune : '',
    kind: read('client'),
    place: valid('lieu', CODE),
    service: valid('prestation', CODE),
    group: valid('groupe', UUID),
    set,
  };
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

/** Types de lieu du filtre, lus une fois les droits connus ; un échec (403 compris) laisse la valeur de l'adresse. */
function usePlaceOptions(administer: boolean | null): PlaceTypeOption[] {
  const [places, setPlaces] = useState<PlaceTypeOption[]>([]);
  useEffect(() => {
    if (administer === null) return;
    let live = true;
    listPlaceTypeOptions(administer).then(
      (data) => {
        if (live) setPlaces(data);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [administer]);
  return places;
}

/** Prestations du filtre (route publique, prestations proposées) ; un échec laisse la valeur de l'adresse. */
function useServiceOptions(): Array<{ code: string; label: string }> {
  const [services, setServices] = useState<Array<{ code: string; label: string }>>([]);
  useEffect(() => {
    let live = true;
    getServiceNames().then(
      (names) => {
        if (live) setServices([...names].map(([code, label]) => ({ code, label })));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return services;
}

/** Ajoute la valeur de l'adresse aux options quand elle n'y figure pas (lieu désactivé, prestation retirée…). */
function withCurrent<T extends { code: string }>(options: T[], code: string, make: (code: string) => T): T[] {
  return code && !options.some((option) => option.code === code) ? [...options, make(code)] : options;
}

function FilterBar({
  filters,
  zones,
  places,
  services,
}: {
  filters: Filters;
  zones: ZoneOption[];
  places: PlaceTypeOption[];
  services: Array<{ code: string; label: string }>;
}) {
  const options = withCurrent(zones, filters.commune, (code) => ({ code, commune: code }));
  const placeOptions = withCurrent(places, filters.place, (code) => ({ code, label: code }));
  const serviceOptions = withCurrent(services, filters.service, (code) => ({ code, label: code }));
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <SelectField
        id="filtre-etat"
        className="col-span-2 lg:col-span-1"
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
      <SelectField
        id="filtre-lieu"
        label={t.placeFilter}
        value={filters.place}
        onChange={(event) => filters.set('lieu', event.target.value)}
      >
        <option value="">{common.all}</option>
        {placeOptions.map((place) => (
          <option key={place.code} value={place.code}>
            {place.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="filtre-prestation"
        label={t.serviceFilter}
        value={filters.service}
        onChange={(event) => filters.set('prestation', event.target.value)}
      >
        <option value="">{common.allFeminine}</option>
        {serviceOptions.map((service) => (
          <option key={service.code} value={service.code}>
            {service.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

/** Filtre du groupe (`?groupe=`), posé par un lien : rappelé au-dessus de la liste, avec de quoi le retirer. */
function GroupFilter({ filters }: { filters: Filters }) {
  if (!filters.group) return null;
  return (
    <div className="rounded-control border-line bg-surface-muted flex flex-wrap items-center gap-3 border p-3">
      <span className="text-ink font-semibold">{t.groupFilter}</span>
      <Link href={cleaningPaths.group(filters.group)} className="text-accent-ink font-semibold underline">
        {t.openGroup}
      </Link>
      <button
        type="button"
        onClick={() => filters.set('groupe', '')}
        className="text-ink-muted hover:text-ink min-h-11 font-semibold underline sm:ml-auto"
      >
        {t.clearGroup}
      </button>
    </div>
  );
}

type Applied = Omit<Filters, 'set'>;

/** Une liste par combinaison de filtres, tous appliqués par la gateway (pagination par curseur). */
function Requests({ status, commune, kind, place, service, group }: Applied) {
  const load = useCallback(
    (cursor?: string) =>
      listRequests(
        {
          status: status || undefined,
          commune: commune || undefined,
          customerKind: kind || undefined,
          placeType: place || undefined,
          serviceCode: service || undefined,
          groupId: group || undefined,
        },
        cursor,
      ),
    [status, commune, kind, place, service, group],
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

/** Liste des demandes de devis, filtrable par état, commune, type de client, lieu, prestation et groupe (gateway). */
export function RequestsList() {
  const access = useCleaningAccess();
  const filters = useFilters();
  const zones = useZoneOptions(access ? access.administer : null);
  const places = usePlaceOptions(access ? access.administer : null);
  const services = useServiceOptions();
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
  const { status, commune, kind, place, service, group } = filters;
  const applied = { status, commune, kind, place, service, group };
  return (
    <div className="grid gap-5">
      <FilterBar filters={filters} zones={zones} places={places} services={services} />
      <GroupFilter filters={filters} />
      {/* Une clé par combinaison de filtres : la liste repart de la première page. */}
      <Requests key={Object.values(applied).join('|')} {...applied} />
    </div>
  );
}
