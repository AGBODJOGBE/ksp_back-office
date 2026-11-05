'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { cn } from '@/lib/cn';
import {
  beninInputToIso,
  formatDate,
  formatDateTime,
  formatDuration,
  formatSlot,
  formatXof,
} from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { completeVisit, getRequest, listAgents, rejectRequest, scheduleVisit } from '@/features/cleaning/api';
import { attemptOrReread } from '@/features/cleaning/errors';
import { locationTexts } from '@/features/cleaning/location-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestTexts as t } from '@/features/cleaning/request-detail-texts';
import type { Agent, QuoteRequest } from '@/features/cleaning/schemas';
import { cleaningTexts, recurrenceText, requestStatuses, visitStatuses } from '@/features/cleaning/texts';
import { isOpen, type PrimaryAction, primaryAction } from '@/features/cleaning/workflow';
import { BackLink, LoadingBlock, Note, ResourceView, StatusBadge, useCleaningAccess } from './parts';
import { Block, RequestFacts } from './request-facts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Formulaire du devis et boîte de position : chargés seulement à l'ouverture de la fiche qui les montre. */
const QuoteForm = dynamic(() => import('./quote-form').then((module_) => module_.QuoteForm), {
  loading: () => <LoadingBlock lines={3} />,
});
const LocationAction = dynamic(() => import('./location-action').then((module_) => module_.LocationAction), {
  loading: () => <span aria-hidden="true" className="bg-surface-sunken rounded-control block h-11 w-48" />,
});

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

interface Handlers {
  /** Remplace la demande par la réponse d'une action. */
  onChange: (request: QuoteRequest) => void;
  /** Relit la fiche en gardant l'affichage (après une coupure réseau). */
  onReread: () => void;
}

const grouped = (request: QuoteRequest) => !!request.groupId && request.groupSize > 1;

function VisitDialog({
  request,
  agents,
  label,
  primary,
  onChange,
  onReread,
}: Handlers & { request: QuoteRequest; agents: Agent[] | null; label: string; primary: boolean }) {
  const s = t.scheduleVisit;
  const active = (agents ?? []).filter((agent) => agent.active);
  return (
    <ConfirmAction
      label={label}
      variant={primary ? 'action' : 'secondary'}
      title={s.title}
      description={s.text}
      confirmLabel={s.confirm}
      labels={dialog}
      onConfirm={async (data) => {
        const scheduledAt = beninInputToIso(text(data, 'when'));
        const agentId = text(data, 'agent');
        if (!scheduledAt) return common.invalidDate;
        if (!agentId) return s.chooseAgent;
        return attemptOrReread(
          async () => onChange(await scheduleVisit(request.id, { scheduledAt, agentId })),
          onReread,
          t.networkReread,
        );
      }}
    >
      {grouped(request) ? <FormMessage tone="info">{s.detach}</FormMessage> : null}
      <TextField
        id="visite-date"
        name="when"
        type="datetime-local"
        label={s.when}
        hint={common.beninTime}
        required
      />
      {active.length ? (
        <SelectField id="visite-agent" name="agent" label={s.agent} required defaultValue="">
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
    </ConfirmAction>
  );
}

function ReportDialog({
  request,
  label,
  primary,
  onChange,
  onReread,
}: Handlers & { request: QuoteRequest; label: string; primary: boolean }) {
  const visit = request.visit;
  if (!visit) return null;
  return (
    <ConfirmAction
      label={label}
      variant={primary ? 'action' : 'secondary'}
      title={t.report.title}
      confirmLabel={t.report.confirm}
      labels={dialog}
      onConfirm={async (data) => {
        const report = text(data, 'report');
        if (!report) return common.required;
        return attemptOrReread(
          async () => onChange(await completeVisit(visit.id, report)),
          onReread,
          t.networkReread,
        );
      }}
    >
      <TextAreaField
        id="visite-compte-rendu"
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
 * Barre d'actions : une seule action principale selon l'état (`primaryAction`), puis les actions
 * secondaires que l'état permet, et le refus en rouge discret. La gateway reste seule juge.
 */
function ActionBar({
  request,
  agents,
  primary,
  onOpenQuote,
  onChange,
  onReread,
}: Handlers & {
  request: QuoteRequest;
  agents: Agent[] | null;
  primary: PrimaryAction | null;
  onOpenQuote: () => void;
}) {
  const { visit, status } = request;
  const open = isOpen(request);
  const inGroup = grouped(request);
  const isPrimary = (kind: PrimaryAction['kind']) => primary?.scope === 'request' && primary.kind === kind;
  const handlers = { onChange, onReread };

  let main: ReactNode = null;
  if (primary?.scope === 'group' && request.groupId) {
    main = (
      <ButtonLink variant="action" href={cleaningPaths.group(request.groupId)}>
        {t.primary.group[primary.kind]}
      </ButtonLink>
    );
  } else if (primary?.kind === 'schedule_visit') {
    main = (
      <VisitDialog
        request={request}
        agents={agents}
        label={t.primary.request.schedule_visit}
        primary
        {...handlers}
      />
    );
  } else if (primary?.kind === 'report') {
    main = <ReportDialog request={request} label={t.primary.request.report} primary {...handlers} />;
  } else if (primary?.kind === 'quote') {
    main = (
      <Button variant="action" onClick={onOpenQuote}>
        {t.primary.request.quote}
      </Button>
    );
  } else if (primary?.kind === 'mission' && request.missionId) {
    main = (
      <ButtonLink variant="action" href={cleaningPaths.mission(request.missionId)}>
        {t.primary.request.mission}
      </ButtonLink>
    );
  }

  const secondary: ReactNode[] = [];
  if (open) {
    const visitPending = visit?.status === 'scheduled';
    if (visitPending && !isPrimary('report')) {
      secondary.push(
        <ReportDialog
          key="report"
          request={request}
          label={inGroup ? t.report.labelAlone : t.report.label}
          primary={false}
          {...handlers}
        />,
      );
    }
    if (!visitPending && !isPrimary('schedule_visit')) {
      const label = inGroup
        ? t.scheduleVisit.labelAlone
        : visit
          ? t.scheduleVisit.relabel
          : t.scheduleVisit.label;
      secondary.push(
        <VisitDialog
          key="visit"
          request={request}
          agents={agents}
          label={label}
          primary={false}
          {...handlers}
        />,
      );
    }
    if (visit?.status === 'completed' && !isPrimary('quote')) {
      secondary.push(
        <Button key="quote" variant="secondary" onClick={onOpenQuote}>
          {status === 'quote_sent'
            ? t.sendQuote.relabel
            : inGroup
              ? t.sendQuote.labelAlone
              : t.sendQuote.label}
        </Button>,
      );
    }
  }

  const reject = open ? (
    <ConfirmAction
      label={t.reject.label}
      title={t.reject.title}
      description={t.reject.text}
      confirmLabel={t.reject.confirm}
      labels={dialog}
      danger
      className="ml-auto"
      onConfirm={async (data) => {
        const reason = text(data, 'reason');
        if (!reason) return common.reasonRequired;
        return attemptOrReread(
          async () => onChange(await rejectRequest(request.id, reason)),
          onReread,
          t.networkReread,
        );
      }}
    >
      <TextAreaField
        id="refus-motif"
        name="reason"
        label={common.reasonLabel}
        hint={t.reject.hint}
        minLength={1}
        maxLength={500}
        required
      />
    </ConfirmAction>
  ) : null;

  // Le refus suit la dernière rangée : celle des autres actions, sinon celle de l'action principale.
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {main ? (
          <>
            <span className="text-small text-ink-muted font-semibold">{t.nextStep}</span>
            {main}
          </>
        ) : (
          <Note>{status === 'quote_sent' ? t.quoteSentNote : t.noAction}</Note>
        )}
        {secondary.length ? null : reject}
      </div>
      {secondary.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-small text-ink-muted font-semibold">{t.otherActions}</span>
          {secondary}
          {reject}
        </div>
      ) : null}
    </div>
  );
}

type StepState = 'done' | 'current' | 'upcoming' | 'idle';

/** Étape numérotée de la fiche ; son état est donné en texte (pas seulement par la couleur). */
function Step({
  index,
  title,
  state,
  id,
  action,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  id: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const label = state === 'idle' ? null : t.steps[state];
  return (
    <li>
      <section aria-labelledby={id} className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold',
              state === 'done' && 'bg-action text-on-action',
              state === 'current' && 'bg-brand text-on-brand',
              (state === 'upcoming' || state === 'idle') && 'bg-surface-sunken text-ink-muted',
            )}
          >
            {index}
          </span>
          <Heading as="h2" size="h3" id={id}>
            {title}
            {label ? <span className="text-small text-ink-muted ml-2 font-medium">· {label}</span> : null}
          </Heading>
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
        <div className="min-w-0 sm:pl-13">{children}</div>
      </section>
    </li>
  );
}

function stepStates(request: QuoteRequest): [StepState, StepState] {
  const open = isOpen(request) || request.status === 'accepted';
  const visitDone = request.visit?.status === 'completed';
  const quoteDone = !!request.quote;
  if (!open) return [visitDone ? 'done' : 'idle', quoteDone ? 'done' : 'idle'];
  return [visitDone ? 'done' : 'current', quoteDone ? 'done' : visitDone ? 'current' : 'upcoming'];
}

function VisitStep({ request, agents }: { request: QuoteRequest; agents: Agent[] | null }) {
  const visit = request.visit;
  if (!visit) return <Note>{t.visit.none}</Note>;
  const agentName =
    visit.agentName ?? agents?.find((agent) => agent.agentId === visit.agentId)?.displayName ?? null;
  return (
    <Block title={visit.groupVisitId ? t.visit.common : t.visit.own} id="visite-detail">
      <div className="flex flex-wrap gap-2">
        <StatusBadge map={visitStatuses} code={visit.status} />
      </div>
      <DescriptionList
        items={[
          { term: t.visit.when, value: formatDateTime(visit.scheduledAt) },
          { term: t.visit.agent, value: agentName ?? common.unknownAgent },
          { term: t.visit.completedAt, value: visit.completedAt ? formatDateTime(visit.completedAt) : null },
          {
            term: t.visit.report,
            value: visit.report ? <span className="whitespace-pre-line">{visit.report}</span> : null,
          },
        ]}
      />
    </Block>
  );
}

function QuoteStep({ request }: { request: QuoteRequest }) {
  const quote = request.quote;
  const q = t.quote;
  if (!quote) return <Note>{q.none}</Note>;
  return (
    <Block title={q.lines} id="devis-detail">
      <ResponsiveTable
        caption={q.lines}
        rows={quote.lines.map((line, index) => ({ ...line, key: String(index) }))}
        rowKey={(line) => line.key}
        columns={[
          { key: 'label', header: t.calc.columns.label, primary: true, cell: (line) => line.label },
          {
            key: 'quantity',
            header: t.calc.columns.quantity,
            className: 'tabular-nums',
            cell: (line) => line.quantity,
          },
          {
            key: 'unitPrice',
            header: t.calc.columns.unitPrice,
            className: 'tabular-nums',
            cell: (line) => formatXof(line.unitPrice),
          },
          {
            key: 'amount',
            header: t.calc.columns.amount,
            className: 'tabular-nums',
            cell: (line) => formatXof(line.amount),
          },
        ]}
      />
      <DescriptionList
        items={[
          { term: q.subtotal, value: formatXof(quote.subtotal) },
          { term: q.interventions, value: quote.interventionCount },
          { term: q.total, value: <strong>{formatXof(quote.total)}</strong> },
          { term: q.deposit, value: `${formatXof(quote.depositAmount)} (${quote.depositPercent} %)` },
          { term: q.teamSize, value: quote.teamSize },
          { term: q.duration, value: formatDuration(quote.durationMinutes) },
          { term: q.recurrence, value: quote.recurrence ? recurrenceText(quote.recurrence) : null },
          {
            term: q.slots,
            value: (
              <ul className="grid gap-1">
                {quote.proposedSlots.map((slot) => (
                  <li key={slot.start}>{formatSlot(slot)}</li>
                ))}
              </ul>
            ),
          },
          { term: q.validUntil, value: formatDate(quote.validUntil) },
          { term: q.sentAt, value: formatDateTime(quote.sentAt) },
        ]}
      />
    </Block>
  );
}

function RequestView({
  request,
  agents,
  onChange,
  onReread,
}: Handlers & { request: QuoteRequest; agents: Agent[] | null }) {
  const access = useCleaningAccess();
  const serviceName = useServiceName();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const primary = primaryAction(request);
  const [visitState, quoteState] = stepStates(request);
  const supervise = !!access?.supervise;

  useEffect(() => {
    if (quoteOpen) document.getElementById('devis-titre')?.scrollIntoView?.({ block: 'start' });
  }, [quoteOpen]);

  const change = (next: QuoteRequest) => {
    setNotice(null);
    onChange(next);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {t.title(request.serviceName?.trim() || serviceName(request.serviceCode))}
          </Heading>
          <StatusBadge map={requestStatuses} code={request.status} />
        </div>
        <p className="text-ink-muted">{t.receivedAt(formatDateTime(request.createdAt))}</p>
      </div>

      {grouped(request) && request.groupId ? (
        <div className="rounded-card border-brand-muted bg-brand-soft flex flex-wrap items-center justify-between gap-3 border p-4">
          <p className="text-brand-ink max-w-reading">{t.group.banner(request.groupSize)}</p>
          <ButtonLink variant="secondary" href={cleaningPaths.group(request.groupId)}>
            {t.group.open}
          </ButtonLink>
        </div>
      ) : null}

      {supervise ? (
        <ActionBar
          request={request}
          agents={agents}
          primary={primary}
          onOpenQuote={() => setQuoteOpen(true)}
          onChange={change}
          onReread={onReread}
        />
      ) : null}
      <FormMessage tone="success">{notice}</FormMessage>

      <ol aria-label={t.steps.label} className="grid gap-8">
        <Step index={1} title={t.steps.request} state="done" id="etape-demande">
          <RequestFacts request={request} />
        </Step>
        <Step
          index={2}
          title={t.steps.visit}
          state={visitState}
          id="etape-visite"
          action={
            supervise ? (
              <LocationAction
                requestId={request.id}
                location={request.location}
                onReread={onReread}
                rereadNote={t.networkReread}
                onDone={(correction) => {
                  onChange(correction.request);
                  setNotice(
                    locationTexts.done(
                      correction.updatedRequestIds.length,
                      correction.updatedMissionIds.length,
                    ),
                  );
                }}
              />
            ) : null
          }
        >
          <VisitStep request={request} agents={agents} />
        </Step>
        <Step index={3} title={t.steps.quote} state={quoteState} id="etape-devis">
          <QuoteStep request={request} />
          {quoteOpen && supervise ? (
            <QuoteForm
              request={request}
              onCancel={() => setQuoteOpen(false)}
              onReread={onReread}
              rereadNote={t.networkReread}
              onSent={(next) => {
                setQuoteOpen(false);
                change(next);
              }}
            />
          ) : null}
        </Step>
      </ol>
    </div>
  );
}

/** Fiche d'une demande de devis en trois étapes ordonnées : demande, visite, devis. */
export function RequestDetail({ id }: { id: string }) {
  const request = useResource(useCallback(() => getRequest(id), [id]));
  // Agents : noms de la visite et choix de l'agent. Un échec n'empêche pas d'afficher la demande.
  const agents = useResource(listAgents);
  return (
    <div className="grid gap-4">
      {request.state.status === 'error' ? <BackLink href={cleaningPaths.requests}>{t.back}</BackLink> : null}
      <ResourceView resource={request} lines={6} refusals={{ forbidden: t.forbidden, notFound: t.notFound }}>
        {(data) => (
          <RequestView
            request={data}
            agents={agents.state.status === 'ready' ? agents.state.data : null}
            onChange={request.set}
            onReread={request.refresh}
          />
        )}
      </ResourceView>
    </div>
  );
}
