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
import { type Resource, useResource } from '@/lib/use-resource';
import {
  completeVisit,
  getMission,
  getRequest,
  listAgents,
  rejectRequest,
  scheduleVisit,
} from '@/features/cleaning/api';
import { attemptOrReread } from '@/features/cleaning/errors';
import { locationTexts } from '@/features/cleaning/location-texts';
import { measureTexts } from '@/features/cleaning/measure-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestTexts as t } from '@/features/cleaning/request-detail-texts';
import type { Agent, Mission, QuoteRequest } from '@/features/cleaning/schemas';
import {
  cleaningTexts,
  missionStatuses,
  paymentStatuses,
  recurrenceText,
  requestStatuses,
  visitStatuses,
} from '@/features/cleaning/texts';
import {
  DOSSIER_STEPS,
  type DossierStep,
  dossierStep,
  isOpen,
  measurementsOpen,
  type PrimaryAction,
  primaryAction,
  type StepState,
  stepState,
} from '@/features/cleaning/workflow';
import { BackLink, LoadingBlock, Note, ResourceView, StatusBadge, useCleaningAccess } from './parts';
import { Block, RequestFacts } from './request-facts';
import { StepBanner } from './step-banner';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Formulaire du devis et boîte de position : chargés seulement à l'ouverture de la fiche qui les montre. */
const QuoteForm = dynamic(() => import('./quote-form').then((module_) => module_.QuoteForm), {
  loading: () => <LoadingBlock lines={3} />,
});
const MeasurementsPanel = dynamic(
  () => import('./measurements-panel').then((module_) => module_.MeasurementsPanel),
  { loading: () => <LoadingBlock lines={4} /> },
);
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

/** Rejet de la demande (rouge discret, à part des autres actions). */
function RejectDialog({ request, onChange, onReread }: Handlers & { request: QuoteRequest }) {
  return (
    <ConfirmAction
      label={t.reject.label}
      title={t.reject.title}
      description={t.reject.text}
      confirmLabel={t.reject.confirm}
      labels={dialog}
      danger
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
  );
}

/** Étape repliable (`<details>`) : seule l'étape en cours est ouverte au départ. */
function StepSection({
  step,
  index,
  state,
  open,
  onToggle,
  children,
}: {
  step: DossierStep;
  index: number;
  state: StepState;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      id={`etape-${step}`}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className={cn(
        'rounded-card border-line bg-surface scroll-mt-4 border',
        state === 'current' && 'border-brand-muted ring-brand-muted ring-1',
      )}
    >
      <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-3 p-4 sm:px-5">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full font-semibold',
            state === 'done' && 'bg-action text-on-action',
            state === 'current' && 'bg-brand text-on-brand',
            state === 'upcoming' && 'bg-surface-sunken text-ink-muted',
          )}
        >
          {index}
        </span>
        <h2 className="font-display text-h3 text-ink font-semibold">{t.steps[step]}</h2>
        <span className="text-small text-ink-muted">· {t.steps[state]}</span>
      </summary>
      <div className="grid min-w-0 gap-4 border-t border-inherit p-4 sm:p-5">{children}</div>
    </details>
  );
}

function MissionStep({ request, mission }: { request: QuoteRequest; mission: Resource<Mission> | null }) {
  const m = t.mission;
  if (!request.missionId) return <Note>{m.none}</Note>;
  const state = mission?.state;
  return (
    <div className="grid gap-3">
      {state?.status === 'ready' ? (
        <DescriptionList
          items={[
            { term: m.status, value: <StatusBadge map={missionStatuses} code={state.data.status} /> },
            {
              term: m.interventions,
              value: `${state.data.completedInterventions} / ${state.data.plannedInterventions}`,
            },
          ]}
        />
      ) : (
        <Note>{state?.status === 'error' ? m.unavailable : m.loading}</Note>
      )}
      <ButtonLink
        variant="secondary"
        className="justify-self-start"
        href={cleaningPaths.mission(request.missionId)}
      >
        {m.open}
      </ButtonLink>
    </div>
  );
}

function PaymentStep({ request, mission }: { request: QuoteRequest; mission: Resource<Mission> | null }) {
  const p = t.payment;
  const state = mission?.state;
  if (!request.missionId || state?.status !== 'ready') return <Note>{p.none}</Note>;
  const { payment } = state.data;
  return (
    <div className="grid gap-3">
      {request.customerKind === 'business' ? <Note>{p.business}</Note> : null}
      <DescriptionList
        items={[
          { term: p.status, value: <StatusBadge map={paymentStatuses} code={payment.status} /> },
          { term: p.paid, value: formatXof(payment.paid) },
          { term: p.total, value: formatXof(payment.total) },
        ]}
      />
    </div>
  );
}

/**
 * Action principale de l'étape en cours (un seul bouton mis en avant) et sa phrase d'explication ; actions
 * secondaires dessous, le refus à part. La gateway reste seule juge.
 */
function NextAction({
  request,
  agents,
  primary,
  current,
  onMeasure,
  onOpenQuote,
  onChange,
  onReread,
}: Handlers & {
  request: QuoteRequest;
  agents: Agent[] | null;
  primary: PrimaryAction | null;
  current: ReturnType<typeof dossierStep>;
  onMeasure: () => void;
  onOpenQuote: () => void;
}) {
  const { visit, status } = request;
  const open = isOpen(request);
  const inGroup = grouped(request);
  const handlers = { onChange, onReread };
  const isPrimary = (kind: PrimaryAction['kind']) => primary?.scope === 'request' && primary.kind === kind;

  let main: ReactNode = null;
  let guidance: string | null = null;
  if (primary?.scope === 'group' && request.groupId) {
    guidance = t.guidance.group;
    main = (
      <ButtonLink variant="action" size="lg" href={cleaningPaths.group(request.groupId)}>
        {t.primary.group[primary.kind]}
      </ButtonLink>
    );
  } else if (primary?.kind === 'schedule_visit') {
    guidance = t.guidance.schedule_visit;
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
    guidance = t.guidance.report;
    main = (
      <Button variant="action" size="lg" onClick={onMeasure}>
        {t.measuresAction}
      </Button>
    );
  } else if (primary?.kind === 'quote') {
    guidance = t.guidance.quote;
    main = (
      <Button variant="action" size="lg" onClick={onOpenQuote}>
        {t.primary.request.quote}
      </Button>
    );
  } else if (current === 'payment' && request.missionId) {
    guidance = t.guidance.payment;
    main = (
      <ButtonLink variant="action" size="lg" href={cleaningPaths.mission(request.missionId)}>
        {t.paymentAction}
      </ButtonLink>
    );
  } else if (primary?.kind === 'mission' && request.missionId) {
    guidance = t.guidance.mission;
    main = (
      <ButtonLink variant="action" size="lg" href={cleaningPaths.mission(request.missionId)}>
        {t.primary.request.mission}
      </ButtonLink>
    );
  }

  const secondary: ReactNode[] = [];
  if (open) {
    const visitPending = visit?.status === 'scheduled';
    if (visitPending) {
      secondary.push(
        <ReportDialog
          key="report"
          request={request}
          label={inGroup && visit?.groupVisitId ? t.report.labelAlone : t.report.label}
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

  return (
    <section
      aria-labelledby="prochaine-etape"
      className="rounded-card border-brand-muted bg-brand-soft grid gap-3 border p-4 sm:p-5"
    >
      <h2 id="prochaine-etape" className="text-small text-brand-ink font-semibold tracking-wide uppercase">
        {t.nextStep}
      </h2>
      {main ? (
        <>
          {guidance ? <p className="text-ink max-w-reading">{guidance}</p> : null}
          <div className="flex flex-wrap items-center gap-3">{main}</div>
        </>
      ) : (
        <p className="text-ink">
          {status === 'quote_sent'
            ? t.quoteSentNote
            : current === 'done'
              ? t.steps.finished
              : current === 'closed'
                ? t.steps.closed
                : t.noAction}
        </p>
      )}
      {secondary.length || open ? (
        <div className="flex flex-wrap items-center gap-3">
          {secondary.length ? (
            <span className="text-small text-ink-muted font-semibold">{t.otherActions}</span>
          ) : null}
          {secondary}
          {open ? (
            <span className="sm:ml-auto">
              <RejectDialog request={request} {...handlers} />
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
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
  const supervise = !!access?.supervise;
  const missionLoad = useCallback(
    () => (request.missionId ? getMission(request.missionId) : Promise.reject(new Error('no mission'))),
    [request.missionId],
  );
  const missionResource = useResource(missionLoad);
  const mission = request.missionId ? missionResource : null;
  const missionData = mission?.state.status === 'ready' ? mission.state.data : null;
  const current = dossierStep(request, missionData);
  const primary = primaryAction(request);
  const [opened, setOpened] = useState<ReadonlySet<DossierStep>>(
    () => new Set(current === 'done' || current === 'closed' ? ['request'] : [current]),
  );
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const name = request.serviceName?.trim() || serviceName(request.serviceCode);

  const toggle = (step: DossierStep, open: boolean) =>
    setOpened((previous) => {
      if (previous.has(step) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(step);
      else next.delete(step);
      return next;
    });
  const reveal = (step: DossierStep, target: string) => {
    toggle(step, true);
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView?.({ block: 'start' }));
  };

  useEffect(() => {
    if (quoteOpen) document.getElementById('devis-titre')?.scrollIntoView?.({ block: 'start' });
  }, [quoteOpen]);

  const change = (next: QuoteRequest) => {
    setNotice(null);
    onChange(next);
  };

  const visitId = request.visit?.status === 'scheduled' ? request.visit.id : null;
  const sections: Record<DossierStep, ReactNode> = {
    request: <RequestFacts request={request} serviceName={name} />,
    visit: (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <VisitStep request={request} agents={agents} />
          {supervise ? (
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
          ) : null}
        </div>
        <Block title={measureTexts.measures.title} id="mesures">
          <MeasurementsPanel
            requestId={request.id}
            serviceCode={request.serviceCode}
            request={request}
            visitId={supervise ? visitId : null}
            locked={!supervise || !measurementsOpen(request)}
            idPrefix="mesures"
            onSaved={(next) => change(next)}
          />
        </Block>
      </>
    ),
    quote: (
      <>
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
      </>
    ),
    mission: <MissionStep request={request} mission={mission} />,
    payment: <PaymentStep request={request} mission={mission} />,
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {t.title(name)}
          </Heading>
          <StatusBadge map={requestStatuses} code={request.status} />
        </div>
        <p className="text-ink-muted">
          {[request.placeTypeLabel, request.commune, t.receivedAt(formatDateTime(request.createdAt))]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {grouped(request) && request.groupId ? (
        <div className="rounded-card border-line bg-surface flex flex-wrap items-center justify-between gap-3 border p-4">
          <p className="text-ink max-w-reading">{t.group.banner(request.groupSize)}</p>
          <ButtonLink variant="secondary" href={cleaningPaths.group(request.groupId)}>
            {t.group.open}
          </ButtonLink>
        </div>
      ) : null}

      <StepBanner
        label={t.steps.label}
        items={DOSSIER_STEPS.map((step) => ({
          key: step,
          title: t.steps[step],
          state: stepState(step, current, request),
          href: `#etape-${step}`,
          onSelect: () => toggle(step, true),
        }))}
      />

      {supervise ? (
        <NextAction
          request={request}
          agents={agents}
          primary={primary}
          current={current}
          onMeasure={() => reveal('visit', 'mesures')}
          onOpenQuote={() => {
            toggle('quote', true);
            setQuoteOpen(true);
          }}
          onChange={change}
          onReread={onReread}
        />
      ) : null}
      <FormMessage tone="success">{notice}</FormMessage>

      <div className="grid gap-3">
        {DOSSIER_STEPS.map((step, index) => (
          <StepSection
            key={step}
            step={step}
            index={index + 1}
            state={stepState(step, current, request)}
            open={opened.has(step)}
            onToggle={(open) => toggle(step, open)}
          >
            {sections[step]}
          </StepSection>
        ))}
      </div>
    </div>
  );
}

/**
 * Fiche dossier d'une demande, par étapes : Demande → Visite et mesures → Devis → Mission → Paiement. Bandeau
 * d'avancement, action suivante mise en avant, étapes repliées sauf celle en cours.
 */
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
