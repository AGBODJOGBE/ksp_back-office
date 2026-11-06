'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { newIdempotencyKey } from '@/lib/api';
import { beninInputToIso, formatDateTime, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { listAgents, listGroupRequests, rejectGroup, scheduleGroupVisit } from '@/features/cleaning/api';
import { groupErrorText, serviceLabel, skippedLines } from '@/features/cleaning/group-errors';
import { groupTexts as t } from '@/features/cleaning/group-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Agent, GroupOutcome, QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts, customerKind, customerLabel, requestStatuses } from '@/features/cleaning/texts';
import {
  DOSSIER_STEPS,
  type GroupActionKind,
  groupPrimaryAction,
  groupStep,
  hasScheduledGroupVisit,
  isOpen,
  isQuotable,
  type StepState,
} from '@/features/cleaning/workflow';
import { requestTexts } from '@/features/cleaning/request-detail-texts';
import { BackLink, LoadingBlock, Note, ResourceView, StatusBadge, useCleaningAccess } from './parts';
import { Block, PositionText } from './request-facts';
import { StepBanner } from './step-banner';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

const GroupReportForm = dynamic(
  () => import('./group-report-form').then((module_) => module_.GroupReportForm),
  { loading: () => <LoadingBlock lines={4} /> },
);
const GroupQuotesForm = dynamic(
  () => import('./group-quotes-form').then((module_) => module_.GroupQuotesForm),
  { loading: () => <LoadingBlock lines={4} /> },
);

/** Nombre de demandes que l'on peut exclure de la visite commune (contrat : `excludeRequestIds`, 10 au plus). */
const MAX_EXCLUDED = 10;

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

type Done = { kind: 'visit' | 'report' | 'quotes' | 'reject'; outcome: GroupOutcome };

interface GroupProps {
  groupId: string;
  requests: QuoteRequest[];
  onOutcome: (done: Done) => void;
}

/**
 * Clé d'idempotence d'une boîte : tirée à chaque ouverture, renvoyée telle quelle si l'agent renvoie
 * depuis la même boîte (une coupure réseau ne crée pas d'opération en double).
 */
function useOperationKey() {
  const key = useRef('');
  return { draw: () => (key.current = newIdempotencyKey()), get: () => key.current };
}

async function run(
  operation: () => Promise<GroupOutcome>,
  kind: Done['kind'],
  requests: QuoteRequest[],
  onOutcome: (done: Done) => void,
): Promise<string | null> {
  try {
    onOutcome({ kind, outcome: await operation() });
    return null;
  } catch (error) {
    return groupErrorText(error, requests);
  }
}

function GroupVisitDialog({
  groupId,
  requests,
  agents,
  primary,
  onOutcome,
}: GroupProps & { agents: Agent[] | null; primary: boolean }) {
  const key = useOperationKey();
  const s = t.visit;
  const active = (agents ?? []).filter((agent) => agent.active);
  const candidates = requests.filter(isOpen);
  return (
    <ConfirmAction
      label={hasScheduledGroupVisit(requests) ? s.relabel : s.label}
      variant={primary ? 'action' : 'secondary'}
      title={s.title}
      description={s.text}
      confirmLabel={s.confirm}
      labels={dialog}
      onOpen={key.draw}
      onConfirm={async (data) => {
        const scheduledAt = beninInputToIso(text(data, 'when'));
        const agentId = text(data, 'agent');
        const excludeRequestIds = data.getAll('exclude').map(String);
        if (!scheduledAt) return common.invalidDate;
        if (!agentId) return s.chooseAgent;
        if (excludeRequestIds.length > MAX_EXCLUDED) return s.tooMany;
        return run(
          () => scheduleGroupVisit(groupId, { scheduledAt, agentId, excludeRequestIds }, key.get()),
          'visit',
          requests,
          onOutcome,
        );
      }}
    >
      <TextField
        id="visite-groupe-date"
        name="when"
        type="datetime-local"
        label={s.when}
        hint={common.beninTime}
        required
      />
      {active.length ? (
        <SelectField id="visite-groupe-agent" name="agent" label={s.agent} required defaultValue="">
          <option value="" disabled>
            {s.chooseAgent}
          </option>
          {active.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.displayName}
            </option>
          ))}
        </SelectField>
      ) : (
        <Note>{agents ? s.noAgent : common.loading}</Note>
      )}
      {candidates.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="text-ink font-semibold">{s.exclude}</legend>
          <p className="text-small text-ink-muted">{s.excludeHint}</p>
          {candidates.map((request) => (
            <label key={request.id} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="exclude" value={request.id} className="accent-brand size-5" />
              {serviceLabel(request)}
            </label>
          ))}
        </fieldset>
      ) : null}
    </ConfirmAction>
  );
}

function GroupRejectDialog({ groupId, requests, onOutcome }: GroupProps) {
  const key = useOperationKey();
  const s = t.reject;
  return (
    <ConfirmAction
      label={s.label}
      title={s.title}
      description={s.text}
      confirmLabel={s.confirm}
      labels={dialog}
      danger
      className="ml-auto"
      onOpen={key.draw}
      onConfirm={async (data) => {
        const reason = text(data, 'reason');
        if (!reason) return common.reasonRequired;
        return run(() => rejectGroup(groupId, reason, key.get()), 'reject', requests, onOutcome);
      }}
    >
      <TextAreaField
        id="refus-groupe-motif"
        name="reason"
        label={common.reasonLabel}
        hint={s.hint}
        minLength={1}
        maxLength={500}
        required
      />
    </ConfirmAction>
  );
}

function visitCell(request: QuoteRequest): string {
  const visit = request.visit;
  if (!visit || visit.status === 'cancelled') return t.noVisit;
  if (visit.status === 'completed')
    return t.visitDone(formatDateTime(visit.completedAt ?? visit.scheduledAt));
  const date = formatDateTime(visit.scheduledAt);
  return visit.groupVisitId ? t.visitCommon(date) : t.visitOwn(date);
}

function GroupTable({ requests }: { requests: QuoteRequest[] }) {
  return (
    <ResponsiveTable
      caption={t.caption}
      rows={requests}
      rowKey={(request) => request.id}
      columns={[
        {
          key: 'service',
          header: t.columns.service,
          primary: true,
          cell: (request) => (
            <Link
              href={cleaningPaths.request(request.id)}
              aria-label={t.openRequest(serviceLabel(request))}
              className="stretched-link hover:underline"
            >
              {serviceLabel(request)}
            </Link>
          ),
        },
        {
          key: 'status',
          header: t.columns.status,
          cell: (request) => <StatusBadge map={requestStatuses} code={request.status} />,
        },
        { key: 'visit', header: t.columns.visit, cell: visitCell },
        {
          key: 'quote',
          header: t.columns.quote,
          className: 'tabular-nums',
          cell: (request) =>
            request.missionId ? (
              <Link
                href={cleaningPaths.mission(request.missionId)}
                className="text-accent-ink relative z-10 font-semibold underline"
              >
                {t.openMission}
              </Link>
            ) : request.quote ? (
              formatXof(request.quote.total)
            ) : (
              t.noQuote
            ),
        },
      ]}
    />
  );
}

function Outcome({ done, requests }: { done: Done | null; requests: QuoteRequest[] }) {
  if (!done) return <FormMessage tone="success" />;
  const skipped = skippedLines(done.outcome.skipped, requests);
  return (
    <div className="grid gap-3">
      <FormMessage tone="success">
        {t.outcome.done[done.kind]} {t.outcome.affected(done.outcome.affectedRequestIds.length)}
      </FormMessage>
      {skipped.length ? (
        <div className="rounded-control border-line bg-surface-muted grid gap-2 border p-4">
          <p className="text-ink font-semibold">{t.outcome.skippedTitle}</p>
          <ul className="text-small grid list-disc gap-1 pl-5">
            {skipped.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function GroupView({
  groupId,
  requests,
  agents,
  onChange,
}: {
  groupId: string;
  requests: QuoteRequest[];
  agents: Agent[] | null;
  onChange: (requests: QuoteRequest[]) => void;
}) {
  const access = useCleaningAccess();
  const [done, setDone] = useState<Done | null>(null);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const first = requests[0];
  const p = t.place;
  if (!first) {
    return (
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
        <FormMessage tone="info">{t.empty}</FormMessage>
      </div>
    );
  }

  const primary = groupPrimaryAction(requests);
  const onOutcome = (next: Done) => {
    setDone(next);
    setQuotesOpen(false);
    setReportOpen(false);
    onChange(next.outcome.requests);
  };
  const props = { groupId, requests, onOutcome };
  const anyOpen = requests.some(isOpen);
  const canQuote = requests.some(isQuotable);

  const actions: Partial<Record<GroupActionKind, ReactNode>> = {};
  // Visite commune (ou replanification) tant qu'une demande ouverte n'est pas visitée : une demande déjà
  // visitée est laissée de côté par la gateway (`visit_completed`).
  if (requests.some((r) => isOpen(r) && r.visit?.status !== 'completed')) {
    actions.visit = <GroupVisitDialog key="visit" {...props} agents={agents} primary={primary === 'visit'} />;
  }
  if (hasScheduledGroupVisit(requests)) {
    actions.report = (
      <Button
        key="report"
        variant={primary === 'report' ? 'action' : 'secondary'}
        size={primary === 'report' ? 'lg' : undefined}
        onClick={() => {
          setQuotesOpen(false);
          setReportOpen(true);
        }}
      >
        {t.report.label}
      </Button>
    );
  }
  if (canQuote) {
    actions.quotes = (
      <Button
        key="quotes"
        variant={primary === 'quotes' ? 'action' : 'secondary'}
        size={primary === 'quotes' ? 'lg' : undefined}
        onClick={() => {
          setReportOpen(false);
          setQuotesOpen(true);
        }}
      >
        {t.quotes.label}
      </Button>
    );
  }
  const main = primary ? actions[primary] : null;
  const current = groupStep(requests);
  const stateOf = (index: number): StepState => {
    if (current === 'closed') return 'upcoming';
    const now = DOSSIER_STEPS.indexOf(current);
    return index < now ? 'done' : index === now ? 'current' : 'upcoming';
  };
  const commonVisit = requests.filter(
    (r) => isOpen(r) && r.visit?.status === 'scheduled' && !!r.visit.groupVisitId,
  );
  const others = (Object.keys(actions) as GroupActionKind[])
    .filter((kind) => kind !== primary)
    .map((kind) => actions[kind]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
        <Heading as="h1" size="h2">
          {t.heading(requests.length)}
        </Heading>
        <p className="text-ink-muted max-w-reading">{t.lead}</p>
      </div>

      <StepBanner
        label={t.steps}
        items={DOSSIER_STEPS.map((step, index) => ({
          key: step,
          title: requestTexts.steps[step],
          state: stateOf(index),
        }))}
      />

      {access?.supervise ? (
        <section aria-labelledby="groupe-actions" className="grid gap-3">
          <h2 id="groupe-actions" className="sr-only">
            {t.actions}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {main ? (
              <>
                <span className="text-small text-ink-muted font-semibold">{t.nextStep}</span>
                {primary ? <span className="text-ink w-full">{t.guidance[primary]}</span> : null}
                {main}
              </>
            ) : (
              <Note>{t.noAction}</Note>
            )}
            {!others.length && anyOpen ? <GroupRejectDialog {...props} /> : null}
          </div>
          {others.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-small text-ink-muted font-semibold">{t.otherActions}</span>
              {others}
              {anyOpen ? <GroupRejectDialog {...props} /> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <Outcome done={done} requests={requests} />

      {reportOpen && access?.fieldWork ? (
        <GroupReportForm
          groupId={groupId}
          requests={commonVisit}
          onCancel={() => setReportOpen(false)}
          onDone={(outcome) => onOutcome({ kind: 'report', outcome })}
        />
      ) : null}

      {quotesOpen ? (
        <GroupQuotesForm
          groupId={groupId}
          requests={requests}
          onCancel={() => setQuotesOpen(false)}
          onSent={(outcome) => onOutcome({ kind: 'quotes', outcome })}
        />
      ) : null}

      <div className="grid gap-4">
        <Block title={t.requests} id="groupe-demandes">
          <GroupTable requests={requests} />
          <Note>{t.noTotals}</Note>
        </Block>
        <Block title={t.customer} id="groupe-lieu">
          <DescriptionList
            items={[
              { term: p.customer, value: customerLabel(first) },
              { term: p.kind, value: customerKind(first.customerKind) },
              { term: p.placeType, value: first.placeTypeLabel ?? first.placeType },
              { term: p.landmark, value: first.landmark },
              { term: p.address, value: first.address !== first.landmark ? first.address : null },
              { term: p.geocodedAddress, value: first.geocodedAddress },
              { term: p.commune, value: first.commune },
              { term: p.position, value: first.location ? <PositionText location={first.location} /> : null },
            ]}
          />
        </Block>
      </div>
    </div>
  );
}

/**
 * Vue d'un groupe de demandes (même lieu) : demandes lues par la liste filtrée (`?groupId=&limit=10`,
 * aucune route du back-office ne lit un groupe), visite commune, compte rendu commun, devis groupés et refus.
 */
export function GroupDetail({ groupId }: { groupId: string }) {
  const requests = useResource(useCallback(() => listGroupRequests(groupId), [groupId]));
  const agents = useResource(listAgents);
  return (
    <div className="grid gap-4">
      {requests.state.status === 'error' ? <BackLink href={cleaningPaths.requests}>{t.back}</BackLink> : null}
      <ResourceView resource={requests} lines={6} refusals={{ forbidden: t.forbidden, notFound: t.empty }}>
        {(data) => (
          <GroupView
            groupId={groupId}
            requests={data}
            agents={agents.state.status === 'ready' ? agents.state.data : null}
            onChange={requests.set}
          />
        )}
      </ResourceView>
    </div>
  );
}
