'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { newIdempotencyKey } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { completeGroupVisit, completeVisit, listVisits } from '@/features/cleaning/api';
import { attempt, errorText } from '@/features/cleaning/errors';
import { locationTexts } from '@/features/cleaning/location-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import { measureTexts } from '@/features/cleaning/measure-texts';
import type { QuoteRequest, Visit } from '@/features/cleaning/schemas';
import { cleaningTexts, customerLabel, requestStatuses, visitStatuses } from '@/features/cleaning/texts';
import { visitsTexts as t } from '@/features/cleaning/visit-texts';
import { LoadingBlock, Note, StatusBadge, useCleaningAccess } from './parts';

const common = cleaningTexts.common;

/** Boîte « Corriger la position » : chargée seulement quand une ligne la montre. */
const LocationAction = dynamic(() => import('./location-action').then((module_) => module_.LocationAction), {
  loading: () => <span aria-hidden="true" className="bg-surface-sunken rounded-control block h-11 w-40" />,
});

/** Mesures constatées : formulaire chargé seulement à l'ouverture. */
const MeasurementsPanel = dynamic(
  () => import('./measurements-panel').then((module_) => module_.MeasurementsPanel),
  { loading: () => <LoadingBlock lines={4} /> },
);

/** Identifiant de groupe dans l'adresse (`?groupe=`, UUID) ; une valeur mal formée est ignorée. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Période dans l'adresse (`?periode=`) → borne de la gateway, à l'instant de la lecture. */
const PERIODS = { passee: 'past', 'a-venir': 'upcoming' } as const;
type PeriodParam = keyof typeof PERIODS;
const isPeriod = (value: string): value is PeriodParam => value in PERIODS;

type VisitRequest = Visit['requests'][number];

const serviceOf = (request: VisitRequest) => request.serviceName?.trim() || t.unnamedService;

/**
 * Compte rendu d'une demande de la visite (`POST /admin/cleaning/visits/{visitId}/complete`) : chaque
 * demande garde sa propre visite. Ouvert à l'agent de la visite et à la supervision (contrat) ; un refus
 * avant l'heure prévue affiche l'heure renvoyée par la gateway.
 */
export function VisitReportAction({
  visit,
  request,
  named = false,
  secondary = false,
  onDone,
}: {
  visit: Visit;
  request: VisitRequest;
  /** Visite commune : le bouton nomme la prestation (plusieurs boutons sur la même ligne). */
  named?: boolean;
  /** Visite commune : le compte rendu commun est l'action principale, celui d'une demande est secondaire. */
  secondary?: boolean;
  onDone: (message: string) => void;
}) {
  const service = serviceOf(request);
  const customer = customerLabel(visit);
  return (
    <ConfirmAction
      label={named ? t.report.labelFor(service) : t.report.label}
      accessibleLabel={t.report.accessibleLabel(service, customer)}
      variant={secondary ? 'secondary' : 'action'}
      title={t.report.title}
      description={t.report.summary(service, formatDateTime(visit.scheduledAt), visit.commune)}
      confirmLabel={t.report.confirm}
      labels={{ cancel: common.cancel, pending: common.sending }}
      onConfirm={async (data) => {
        const report = String(data.get('report') ?? '').trim();
        if (!report) return common.required;
        const message = await attempt(() => completeVisit(request.visitId, report));
        if (!message) onDone(t.report.done(service, customer));
        return message;
      }}
    >
      <TextAreaField
        id={`compte-rendu-${request.visitId}`}
        name="report"
        label={t.report.field}
        hint={t.report.hint}
        rows={5}
        maxLength={5000}
        required
      />
    </ConfirmAction>
  );
}

/**
 * Compte rendu commun d'une visite de groupe (`POST /admin/cleaning/quote-request-groups/{id}/visits/complete`) :
 * complète toutes les visites encore planifiées de la visite commune. Ouvert à l'agent de la visite et à la
 * supervision ; `Idempotency-Key` tirée à l'ouverture de la boîte, renvoyée telle quelle si l'agent renvoie.
 */
export function GroupReportAction({
  visit,
  groupId,
  onDone,
}: {
  visit: Visit;
  groupId: string;
  onDone: (message: string) => void;
}) {
  const key = useRef('');
  const customer = customerLabel(visit);
  return (
    <ConfirmAction
      label={t.groupReport.label}
      accessibleLabel={t.groupReport.accessibleLabel(customer)}
      variant="action"
      title={t.groupReport.title}
      description={t.groupReport.summary(
        visit.requests.map(serviceOf).join(', '),
        formatDateTime(visit.scheduledAt),
        visit.commune,
      )}
      confirmLabel={t.groupReport.confirm}
      labels={{ cancel: common.cancel, pending: common.sending }}
      onOpen={() => {
        key.current = newIdempotencyKey();
      }}
      onConfirm={async (data) => {
        const report = String(data.get('report') ?? '').trim();
        if (!report) return common.required;
        const message = await attempt(() => completeGroupVisit(groupId, report, key.current));
        if (!message) onDone(t.groupReport.done(customer));
        return message;
      }}
    >
      <TextAreaField
        id={`compte-rendu-commun-${visit.id}`}
        name="report"
        label={t.report.field}
        hint={t.report.hint}
        rows={5}
        maxLength={5000}
        required
      />
    </ConfirmAction>
  );
}

/** Visite commune encore planifiée, avec plusieurs demandes : le compte rendu commun est proposé. */
const isGroupVisit = (visit: Visit) => !!visit.groupVisitId && !!visit.groupId && visit.requests.length > 1;

/** Demande dont on peut encore saisir les mesures : aucun devis envoyé (ADR-037). */
const measurable = (request: VisitRequest) =>
  request.status === 'received' || request.status === 'visit_scheduled';

type Measuring = { visit: Visit; request: VisitRequest };

function columns(
  supervise: boolean,
  onDone: (message: string) => void,
  onMeasure: (measuring: Measuring) => void,
): TableColumn<Visit>[] {
  return [
    {
      key: 'visit',
      header: t.columns.visit,
      primary: true,
      cell: (visit) => (
        <span className="grid">
          <span>{customerLabel(visit)}</span>
          <span className="text-small text-ink-muted font-normal">
            {t.scheduledAt(formatDateTime(visit.scheduledAt))}
          </span>
          {visit.groupVisitId ? (
            <span className="text-small text-ink-muted font-normal">{t.groupVisit}</span>
          ) : null}
          {supervise && visit.groupId ? (
            <Link
              href={cleaningPaths.group(visit.groupId)}
              className="text-small text-accent-ink font-semibold underline"
            >
              {t.openGroup}
            </Link>
          ) : null}
        </span>
      ),
    },
    {
      key: 'requests',
      header: t.columns.requests,
      cell: (visit) => (
        <ul className="grid justify-items-end gap-1 md:justify-items-start">
          {visit.requests.map((request) => (
            <li
              key={request.requestId}
              className="flex flex-wrap items-center justify-end gap-2 md:justify-start"
            >
              {supervise ? (
                <Link
                  href={cleaningPaths.request(request.requestId)}
                  aria-label={t.seeRequest(serviceOf(request))}
                  className="text-accent-ink font-semibold underline"
                >
                  {serviceOf(request)}
                </Link>
              ) : (
                <span>{serviceOf(request)}</span>
              )}
              <StatusBadge map={requestStatuses} code={request.status} />
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'place',
      header: t.columns.place,
      cell: (visit) => {
        const address = visit.address ?? visit.geocodedAddress;
        return (
          <span className="grid text-right md:text-left">
            <span>{visit.commune}</span>
            {address ? <span className="text-small text-ink-muted">{address}</span> : null}
            {visit.landmark && visit.landmark !== address ? (
              <span className="text-small text-ink-muted">{visit.landmark}</span>
            ) : null}
          </span>
        );
      },
    },
    { key: 'agent', header: t.columns.agent, cell: (visit) => visit.agentName ?? common.unknownAgent },
    {
      key: 'status',
      header: t.columns.status,
      cell: (visit) => (
        <span className="grid justify-items-end gap-1 md:justify-items-start">
          <StatusBadge map={visitStatuses} code={visit.status} />
          {visit.completedAt ? (
            <span className="text-small text-ink-muted">
              {t.completedAt(formatDateTime(visit.completedAt))}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      cell: (visit) =>
        visit.status === 'scheduled' && visit.requests.length ? (
          <span className="flex flex-wrap justify-end gap-2 md:justify-start">
            {visit.requests.filter(measurable).map((request) => {
              const label =
                visit.requests.length > 1
                  ? measureTexts.measures.openFor(serviceOf(request))
                  : measureTexts.measures.open;
              return (
                <Button
                  key={`mesures-${request.requestId}`}
                  variant={isGroupVisit(visit) ? 'secondary' : 'action'}
                  aria-label={`${label} — ${serviceOf(request)}, ${customerLabel(visit)}`}
                  onClick={() => onMeasure({ visit, request })}
                >
                  {label}
                </Button>
              );
            })}
            {isGroupVisit(visit) && visit.groupId ? (
              <GroupReportAction visit={visit} groupId={visit.groupId} onDone={onDone} />
            ) : null}
            {visit.requests.map((request) => (
              <VisitReportAction
                key={request.visitId}
                visit={visit}
                request={request}
                named={visit.requests.length > 1}
                secondary
                onDone={onDone}
              />
            ))}
            <LocationAction
              requestId={visit.requests[0]?.requestId ?? ''}
              location={visit.location}
              accessibleLabel={locationTexts.label}
              onDone={(correction) =>
                onDone(
                  locationTexts.done(
                    correction.updatedRequestIds.length,
                    correction.updatedMissionIds.length,
                  ),
                )
              }
            />
          </span>
        ) : (
          <span className="text-small text-ink-muted">{t.noAction}</span>
        ),
    },
  ];
}

/**
 * Mesures constatées d'une demande de la visite (agent sur place ou supervision) : l'agent n'a pas accès à la
 * demande, le formulaire part vide ; après l'enregistrement, la demande renvoyée montre l'écart avec le client.
 * Compte rendu avec les mesures pour une visite propre ; visite commune : mesures seules (compte rendu commun).
 */
function MeasurePanel({
  measuring,
  measured,
  onSaved,
  onClose,
}: {
  measuring: Measuring;
  measured: QuoteRequest | null;
  onSaved: (request: QuoteRequest, withReport: boolean) => void;
  onClose: () => void;
}) {
  const { visit, request } = measuring;
  return (
    <section
      aria-labelledby="mesures-visite-titre"
      className="rounded-card border-brand-muted bg-surface grid scroll-mt-4 gap-4 border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mesures-visite-titre" className="font-display text-h3 text-ink font-semibold">
          {measureTexts.measures.panelTitle(serviceOf(request))}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          {measureTexts.measures.close}
        </Button>
      </div>
      <p className="text-small text-ink-muted">
        {t.report.summary(serviceOf(request), formatDateTime(visit.scheduledAt), visit.commune)}
      </p>
      <MeasurementsPanel
        key={request.requestId}
        requestId={request.requestId}
        serviceCode={request.serviceCode}
        request={measured}
        visitId={isGroupVisit(visit) ? null : request.visitId}
        locked={false}
        idPrefix={`mesures-${request.requestId}`}
        onSaved={onSaved}
      />
    </section>
  );
}

/** Une liste par combinaison de filtres ; l'instant de référence de la période est pris à l'ouverture. */
function Visits({
  status,
  period,
  group,
  supervise,
  onDone,
  onMeasure,
}: {
  status: string;
  period: PeriodParam | '';
  group: string;
  supervise: boolean;
  onDone: (message: string) => void;
  onMeasure: (measuring: Measuring) => void;
}) {
  const [now] = useState(() => new Date().toISOString());
  const load = useCallback(
    (cursor?: string) =>
      listVisits(
        {
          status: status || undefined,
          from: period === 'a-venir' ? now : undefined,
          to: period === 'passee' ? now : undefined,
          groupId: group || undefined,
        },
        cursor,
      ),
    [status, period, group, now],
  );
  const list = usePagedList(load, errorText);
  return (
    <PagedListState list={list} empty={<Note>{t.empty}</Note>} labels={common}>
      <ResponsiveTable
        caption={t.caption}
        columns={columns(supervise, onDone, onMeasure)}
        rows={list.items}
        rowKey={(visit) => visit.id}
      />
    </PagedListState>
  );
}

/**
 * Visites techniques, filtrées dans l'adresse : `?etat=` (état de la visite), `?periode=` (`passee` : prévues
 * avant maintenant ; `a-venir` : à partir de maintenant) et `?groupe=` (groupe de demandes). Le compte rendu
 * (commun pour une visite de groupe, ou par demande) et la correction de la position se font sur la ligne ;
 * la supervision ouvre aussi la fiche de chaque demande et la vue du groupe.
 */
export function VisitsList() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState<Measuring | null>(null);
  const [measured, setMeasured] = useState<QuoteRequest | null>(null);
  // Relecture après un compte rendu : la visite quitte les visites planifiées.
  const [version, setVersion] = useState(0);
  const status = params.get('etat') ?? '';
  const periodParam = params.get('periode') ?? '';
  const period = isPeriod(periodParam) ? periodParam : '';
  const groupParam = params.get('groupe') ?? '';
  const group = UUID.test(groupParam) ? groupParam : '';

  function set(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const query = next.toString();
    setDone(null);
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (!access) return null;
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField
          id="filtre-etat-visite"
          label={t.statusFilter}
          value={status}
          onChange={(event) => set('etat', event.target.value)}
        >
          <option value="">{common.allFeminine}</option>
          {Object.entries(visitStatuses).map(([code, entry]) => (
            <option key={code} value={code}>
              {entry.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="filtre-periode-visite"
          label={t.periodFilter}
          value={period}
          onChange={(event) => set('periode', event.target.value)}
        >
          <option value="">{common.allFeminine}</option>
          {(Object.keys(PERIODS) as PeriodParam[]).map((code) => (
            <option key={code} value={code}>
              {t.periods[PERIODS[code]]}
            </option>
          ))}
        </SelectField>
      </div>
      {group ? (
        <div className="rounded-control border-line bg-surface-muted flex flex-wrap items-center gap-3 border p-3">
          <span className="text-ink font-semibold">{t.groupFilter}</span>
          {access.supervise ? (
            <Link href={cleaningPaths.group(group)} className="text-accent-ink font-semibold underline">
              {t.openGroup}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => set('groupe', '')}
            className="text-ink-muted hover:text-ink min-h-11 font-semibold underline sm:ml-auto"
          >
            {t.clearGroup}
          </button>
        </div>
      ) : null}
      <FormMessage tone="success">{done}</FormMessage>
      {measuring ? (
        <MeasurePanel
          measuring={measuring}
          measured={measured}
          onSaved={(next, withReport) => {
            setMeasured(next);
            if (withReport) {
              setDone(t.report.done(serviceOf(measuring.request), customerLabel(measuring.visit)));
              setMeasuring(null);
              setMeasured(null);
              setVersion((value) => value + 1);
            }
          }}
          onClose={() => {
            setMeasuring(null);
            setMeasured(null);
          }}
        />
      ) : null}
      <Visits
        key={`${status}|${period}|${group}|${version}`}
        status={status}
        period={period}
        group={group}
        supervise={access.supervise}
        onDone={(message) => {
          setDone(message);
          setVersion((value) => value + 1);
        }}
        onMeasure={(next) => {
          setDone(null);
          setMeasured(null);
          setMeasuring(next);
          requestAnimationFrame(() =>
            document.getElementById('mesures-visite-titre')?.scrollIntoView?.({ block: 'start' }),
          );
        }}
      />
    </div>
  );
}
