'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
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
import { attempt } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { requestTexts as t } from '@/features/cleaning/request-texts';
import type { Agent, QuoteRequest } from '@/features/cleaning/schemas';
import {
  cleaningTexts,
  customerKind,
  nameOr,
  premisesType,
  recurrenceText,
  requestStatuses,
  statusOf,
  visitStatuses,
} from '@/features/cleaning/texts';
import { BackLink, LoadingBlock, Note, Panel, ResourceView, StatusBadge, useCleaningAccess } from './parts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };

/** Formulaire du devis : chargé seulement quand l'agent l'ouvre (lignes, créneaux, récurrence). */
const QuoteForm = dynamic(() => import('./quote-form').then((module_) => module_.QuoteForm), {
  loading: () => <LoadingBlock lines={3} />,
});

const reasonField = (id: string) => (
  <TextAreaField id={id} name="reason" label={common.reasonLabel} maxLength={500} required />
);

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Étapes de la demande dans l'ordre du parcours (données de la gateway seulement). La date de
 * planification de la visite n'est pas fournie : l'étape affiche la date prévue de la visite.
 */
function history(request: QuoteRequest, agentName: string | null) {
  const events: Array<{ at: string | null; label: string; note?: string | null }> = [
    { at: request.createdAt, label: t.events.created },
  ];
  if (request.visit) {
    events.push({
      at: null,
      label: t.events.visitScheduled(
        formatDateTime(request.visit.scheduledAt),
        agentName ?? common.unknownAgent,
      ),
    });
    if (request.visit.completedAt) {
      events.push({
        at: request.visit.completedAt,
        label: t.events.visitCompleted,
        note: request.visit.report,
      });
    }
  }
  if (request.quote) {
    events.push({ at: request.quote.sentAt, label: t.events.quoteSent(formatXof(request.quote.total)) });
  }
  events.push({
    at: request.updatedAt,
    label: t.events.updated(statusOf(requestStatuses, request.status).label),
    note: request.closingReason,
  });
  return events;
}

function VisitDialog({
  request,
  agents,
  onDone,
  again,
}: {
  request: QuoteRequest;
  agents: Agent[] | null;
  onDone: (request: QuoteRequest) => void;
  again: boolean;
}) {
  const s = t.scheduleVisit;
  const active = (agents ?? []).filter((agent) => agent.active);
  return (
    <ConfirmAction
      label={again ? s.relabel : s.label}
      variant={again ? 'secondary' : 'primary'}
      title={s.title}
      description={s.text}
      confirmLabel={s.confirm}
      labels={dialog}
      onConfirm={async (data) => {
        const scheduledAt = beninInputToIso(text(data, 'when'));
        const agentId = text(data, 'agent');
        if (!scheduledAt) return common.invalidDate;
        if (!agentId) return s.chooseAgent;
        return attempt(async () => onDone(await scheduleVisit(request.id, { scheduledAt, agentId })));
      }}
    >
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

function Actions({
  request,
  agents,
  onChange,
}: {
  request: QuoteRequest;
  agents: Agent[] | null;
  onChange: (request: QuoteRequest) => void;
}) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const { status, visit } = request;
  const open = ['received', 'visit_scheduled', 'quote_sent'].includes(status);
  const visitPending = visit?.status === 'scheduled';
  const visitDone = visit?.status === 'completed';

  if (status === 'accepted' && request.missionId) {
    return (
      <Link
        href={cleaningPaths.mission(request.missionId)}
        className="text-accent-ink font-semibold underline"
      >
        {t.openMission}
      </Link>
    );
  }
  if (!open) return <Note>{t.noAction}</Note>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {visitPending ? (
          <ConfirmAction
            label={t.report.label}
            variant="primary"
            title={t.report.title}
            confirmLabel={t.report.confirm}
            labels={dialog}
            onConfirm={async (data) => {
              const report = text(data, 'report');
              if (!report) return common.required;
              return attempt(async () => onChange(await completeVisit(visit.id, report)));
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
        ) : (
          <VisitDialog request={request} agents={agents} onDone={onChange} again={!!visit} />
        )}
        {visitDone && !quoteOpen ? (
          <Button
            variant={status === 'quote_sent' ? 'secondary' : 'primary'}
            onClick={() => setQuoteOpen(true)}
          >
            {status === 'quote_sent' ? t.sendQuote.relabel : t.sendQuote.label}
          </Button>
        ) : null}
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
            return attempt(async () => onChange(await rejectRequest(request.id, reason)));
          }}
        >
          {reasonField('refus-motif')}
        </ConfirmAction>
      </div>
      {quoteOpen ? (
        <QuoteForm
          request={request}
          onCancel={() => setQuoteOpen(false)}
          onSent={(next) => {
            setQuoteOpen(false);
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function RequestView({
  request,
  agents,
  onChange,
}: {
  request: QuoteRequest;
  agents: Agent[] | null;
  onChange: (request: QuoteRequest) => void;
}) {
  const access = useCleaningAccess();
  const serviceName = useServiceName();
  const f = t.fields;
  const { visit, quote } = request;
  // Nom de l'agent de la visite : celui de la gateway (ADR-029), sinon celui de la liste des agents.
  const agentName = visit
    ? (visit.agentName ?? agents?.find((agent) => agent.agentId === visit.agentId)?.displayName ?? null)
    : null;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.requests}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {t.title(serviceName(request.serviceCode))}
          </Heading>
          <StatusBadge map={requestStatuses} code={request.status} />
        </div>
        <p className="text-ink-muted">{formatDateTime(request.createdAt)}</p>
      </div>

      {access?.supervise ? (
        <Panel title={t.actions} id="demande-actions">
          <Actions request={request} agents={agents} onChange={onChange} />
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.customer} id="demande-client">
          <DescriptionList
            items={[
              { term: f.kind, value: customerKind(request.customerKind) },
              { term: f.customerName, value: nameOr(request.customerName, common.unnamed) },
              {
                term: f.organizationName,
                value: request.organizationId
                  ? nameOr(request.organizationName, common.unnamedBusiness)
                  : null,
              },
              { term: f.comment, value: request.comment },
              { term: f.closingReason, value: request.closingReason },
            ]}
          />
        </Panel>

        <Panel title={t.premises} id="demande-locaux">
          <DescriptionList
            items={[
              { term: f.address, value: request.address },
              { term: f.commune, value: request.commune },
              { term: f.premisesType, value: premisesType(request.premisesType) },
              { term: f.quantity, value: request.quantity },
              { term: f.options, value: request.options.join(', ') || null },
              { term: f.recurrence, value: request.recurrence ? recurrenceText(request.recurrence) : null },
              { term: f.daysPerWeek, value: request.daysPerWeek },
              { term: f.requestedTeamSize, value: request.requestedTeamSize },
              { term: f.recommendedTeamSize, value: request.recommendedTeamSize },
              {
                term: f.estimate,
                value: request.estimate
                  ? `${formatXof(request.estimate.low)} – ${formatXof(request.estimate.high)}`
                  : null,
              },
              {
                term: f.preferredSlots,
                value: (
                  <ul className="grid gap-1">
                    {request.preferredSlots.map((slot) => (
                      <li key={slot.start}>{formatSlot(slot)}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        </Panel>

        <Panel
          title={t.visit}
          id="demande-visite"
          action={visit ? <StatusBadge map={visitStatuses} code={visit.status} /> : null}
        >
          {visit ? (
            <DescriptionList
              items={[
                { term: t.scheduleVisit.when, value: formatDateTime(visit.scheduledAt) },
                { term: t.scheduleVisit.agent, value: agentName ?? common.unknownAgent },
                { term: t.visitReport, value: visit.report },
              ]}
            />
          ) : (
            <Note>{common.none}</Note>
          )}
        </Panel>

        <Panel title={t.history} id="demande-historique">
          <ol className="border-line grid gap-4 border-l-2 pl-4">
            {history(request, agentName).map((event, index) => (
              <li key={index}>
                {event.at ? <p className="text-small text-ink-muted">{formatDateTime(event.at)}</p> : null}
                <p className="text-ink font-medium">{event.label}</p>
                {event.note ? (
                  <p className="text-small text-ink-muted mt-1 whitespace-pre-line">{event.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {quote ? (
        <Panel title={t.quote} id="demande-devis">
          <ResponsiveTable
            caption={t.quote}
            rows={quote.lines.map((line, index) => ({ ...line, key: String(index) }))}
            rowKey={(line) => line.key}
            columns={[
              { key: 'label', header: t.lineColumns.label, primary: true, cell: (line) => line.label },
              {
                key: 'quantity',
                header: t.lineColumns.quantity,
                className: 'tabular-nums',
                cell: (line) => line.quantity,
              },
              {
                key: 'unitPrice',
                header: t.lineColumns.unitPrice,
                className: 'tabular-nums',
                cell: (line) => formatXof(line.unitPrice),
              },
              {
                key: 'amount',
                header: t.lineColumns.amount,
                className: 'tabular-nums',
                cell: (line) => formatXof(line.amount),
              },
            ]}
          />
          <DescriptionList
            items={[
              { term: t.quoteFields.subtotal, value: formatXof(quote.subtotal) },
              { term: t.quoteFields.interventions, value: quote.interventionCount },
              { term: t.quoteFields.total, value: <strong>{formatXof(quote.total)}</strong> },
              {
                term: t.quoteFields.deposit,
                value: `${formatXof(quote.depositAmount)} (${quote.depositPercent} %)`,
              },
              { term: t.quoteFields.teamSize, value: quote.teamSize },
              { term: t.quoteFields.duration, value: formatDuration(quote.durationMinutes) },
              { term: f.recurrence, value: quote.recurrence ? recurrenceText(quote.recurrence) : null },
              {
                term: t.quoteFields.slots,
                value: (
                  <ul className="grid gap-1">
                    {quote.proposedSlots.map((slot) => (
                      <li key={slot.start}>{formatSlot(slot)}</li>
                    ))}
                  </ul>
                ),
              },
              { term: t.quoteFields.validUntil, value: formatDate(quote.validUntil) },
              { term: t.quoteFields.sentAt, value: formatDateTime(quote.sentAt) },
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}

/** Fiche d'une demande de devis : client, locaux, prestation, visite, devis, historique et actions. */
export function RequestDetail({ id }: { id: string }) {
  const request = useResource(useCallback(() => getRequest(id), [id]));
  // Agents : noms de la visite et choix de l'agent. Un échec n'empêche pas d'afficher la demande.
  const agents = useResource(listAgents);
  return (
    <ResourceView resource={request} lines={6}>
      {(data) => (
        <RequestView
          request={data}
          agents={agents.state.status === 'ready' ? agents.state.data : null}
          onChange={request.set}
        />
      )}
    </ResourceView>
  );
}
