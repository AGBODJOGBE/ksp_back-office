'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { completeVisit, listVisits } from '@/features/cleaning/api';
import { attempt, errorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Visit } from '@/features/cleaning/schemas';
import { cleaningTexts, customerLabel, requestStatuses, visitStatuses } from '@/features/cleaning/texts';
import { visitsTexts as t } from '@/features/cleaning/visit-texts';
import { Note, StatusBadge, useCleaningAccess } from './parts';

const common = cleaningTexts.common;

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
  onDone,
}: {
  visit: Visit;
  request: VisitRequest;
  /** Visite commune : le bouton nomme la prestation (plusieurs boutons sur la même ligne). */
  named?: boolean;
  onDone: (message: string) => void;
}) {
  const service = serviceOf(request);
  const customer = customerLabel(visit);
  return (
    <ConfirmAction
      label={named ? t.report.labelFor(service) : t.report.label}
      accessibleLabel={t.report.accessibleLabel(service, customer)}
      variant="action"
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

function columns(supervise: boolean, onDone: (message: string) => void): TableColumn<Visit>[] {
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
            {visit.landmark ? <span className="text-small text-ink-muted">{visit.landmark}</span> : null}
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
            {visit.requests.map((request) => (
              <VisitReportAction
                key={request.visitId}
                visit={visit}
                request={request}
                named={visit.requests.length > 1}
                onDone={onDone}
              />
            ))}
          </span>
        ) : (
          <span className="text-small text-ink-muted">{t.noAction}</span>
        ),
    },
  ];
}

/** Une liste par combinaison de filtres ; l'instant de référence de la période est pris à l'ouverture. */
function Visits({
  status,
  period,
  supervise,
  onDone,
}: {
  status: string;
  period: PeriodParam | '';
  supervise: boolean;
  onDone: (message: string) => void;
}) {
  const [now] = useState(() => new Date().toISOString());
  const load = useCallback(
    (cursor?: string) =>
      listVisits(
        {
          status: status || undefined,
          from: period === 'a-venir' ? now : undefined,
          to: period === 'passee' ? now : undefined,
        },
        cursor,
      ),
    [status, period, now],
  );
  const list = usePagedList(load, errorText);
  return (
    <PagedListState list={list} empty={<Note>{t.empty}</Note>} labels={common}>
      <ResponsiveTable
        caption={t.caption}
        columns={columns(supervise, onDone)}
        rows={list.items}
        rowKey={(visit) => visit.id}
      />
    </PagedListState>
  );
}

/**
 * Visites techniques, filtrées dans l'adresse : `?etat=` (état de la visite) et `?periode=` (`passee` :
 * prévues avant maintenant ; `a-venir` : à partir de maintenant). Le compte rendu se saisit sur la ligne ;
 * la supervision ouvre aussi la fiche de chaque demande.
 */
export function VisitsList() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [done, setDone] = useState<string | null>(null);
  // Relecture après un compte rendu : la visite quitte les visites planifiées.
  const [version, setVersion] = useState(0);
  const status = params.get('etat') ?? '';
  const periodParam = params.get('periode') ?? '';
  const period = isPeriod(periodParam) ? periodParam : '';

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
      <FormMessage tone="success">{done}</FormMessage>
      <Visits
        key={`${status}|${period}|${version}`}
        status={status}
        period={period}
        supervise={access.supervise}
        onDone={(message) => {
          setDone(message);
          setVersion((value) => value + 1);
        }}
      />
    </div>
  );
}
