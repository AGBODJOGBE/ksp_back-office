'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { DescriptionList } from '@/components/ui/description-list';
import { TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { newIdempotencyKey } from '@/lib/api';
import { formatDate, formatDateTime, formatDuration, formatSlot, formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { cancelMission, getMission, recordPayment } from '@/features/cleaning/api';
import { attempt } from '@/features/cleaning/errors';
import { missionTexts as t } from '@/features/cleaning/mission-texts';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Mission, Suspension } from '@/features/cleaning/schemas';
import {
  cleaningTexts,
  customerKind,
  interventionStatuses,
  missionStatuses,
  paymentMethod,
  paymentOption,
  paymentStatuses,
  nameOr,
  paymentTiming,
  recurrenceText,
  suspensionCauses,
} from '@/features/cleaning/texts';
import { BackLink, LoadingBlock, Note, Panel, ResourceView, StatusBadge, useCleaningAccess } from './parts';
import { useServiceName } from './use-service-names';

const common = cleaningTexts.common;
const dialog = { cancel: common.cancel, pending: common.sending };
const CLOSED = ['completed', 'cancelled'];

const InterventionForm = dynamic(
  () => import('./intervention-form').then((module_) => module_.InterventionForm),
  {
    loading: () => <LoadingBlock lines={3} />,
  },
);

const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** Suspension en cours : depuis quand, et toutes ses causes actives (ADR-030). */
function SuspensionNotice({ suspension }: { suspension: Suspension }) {
  const causes = suspensionCauses(suspension);
  return (
    <div role="status" className="rounded-card border-danger bg-danger-soft grid gap-2 border p-4">
      <p className="text-ink font-semibold">{t.suspended(formatDate(suspension.since))}</p>
      <ul className="text-ink grid list-disc gap-1 pl-5">
        {causes.map((cause, index) => (
          <li key={index}>{cause}</li>
        ))}
      </ul>
      <p className="text-small text-ink-muted">{t.suspendedHint(causes.length)}</p>
    </div>
  );
}

function PaymentDialog({ mission, onChange }: { mission: Mission; onChange: (mission: Mission) => void }) {
  // Clé tirée à l'ouverture et gardée pendant les renvois : un double envoi n'enregistre qu'un paiement.
  const key = useRef('');
  return (
    <ConfirmAction
      label={t.pay.label}
      title={t.pay.title}
      description={t.pay.text}
      confirmLabel={t.pay.confirm}
      labels={dialog}
      onOpen={() => {
        key.current = newIdempotencyKey();
      }}
      onConfirm={async (data) => {
        const amount = field(data, 'amount');
        if (!/^\d+$/.test(amount) || Number(amount) < 1) return common.invalidNumber;
        const reference = field(data, 'reference');
        key.current ||= newIdempotencyKey();
        return attempt(async () =>
          onChange(
            await recordPayment(
              mission.id,
              {
                amount: Number(amount),
                method: field(data, 'method') === 'mobile_money_offline' ? 'mobile_money_offline' : 'cash',
                ...(reference ? { reference } : {}),
              },
              key.current,
            ),
          ),
        );
      }}
    >
      <TextField id="paiement-montant" name="amount" label={t.pay.amount} inputMode="numeric" required />
      <SelectField id="paiement-moyen" name="method" label={t.pay.method} defaultValue="cash">
        <option value="cash">{paymentMethod('cash')}</option>
        <option value="mobile_money_offline">{paymentMethod('mobile_money_offline')}</option>
      </SelectField>
      <TextField id="paiement-reference" name="reference" label={t.pay.reference} maxLength={100} />
    </ConfirmAction>
  );
}

function Actions({ mission, onChange }: { mission: Mission; onChange: (mission: Mission) => void }) {
  const [planning, setPlanning] = useState(false);
  // Mission terminée ou annulée : plus de planification ni d'annulation, mais un particulier règle à la fin.
  const closed = CLOSED.includes(mission.status);
  // Type de client porté par la mission : une entreprise règle par sa facture. Absent, la gateway tranche.
  const business = mission.customerKind === 'business';
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {!closed && !planning && !mission.suspension ? (
          <Button onClick={() => setPlanning(true)}>{t.schedule.label}</Button>
        ) : null}
        {!business && mission.payment.status !== 'paid' ? (
          <PaymentDialog mission={mission} onChange={onChange} />
        ) : null}
        {closed ? null : (
          <ConfirmAction
            label={t.cancel.label}
            title={t.cancel.title}
            description={t.cancel.text}
            confirmLabel={t.cancel.confirm}
            labels={dialog}
            danger
            onConfirm={async (data) => {
              const reason = field(data, 'reason');
              if (!reason) return common.reasonRequired;
              return attempt(async () => onChange(await cancelMission(mission.id, reason)));
            }}
          >
            <TextAreaField
              id="annulation-motif"
              name="reason"
              label={common.reasonLabel}
              maxLength={500}
              required
            />
          </ConfirmAction>
        )}
      </div>
      {closed ? <Note>{t.closed}</Note> : null}
      {business ? <Note>{t.businessPayment}</Note> : null}
      {planning ? (
        <InterventionForm
          mission={mission}
          onCancel={() => setPlanning(false)}
          onDone={(next) => {
            setPlanning(false);
            onChange(next);
          }}
        />
      ) : null}
    </div>
  );
}

function MissionView({ mission, onChange }: { mission: Mission; onChange: (mission: Mission) => void }) {
  const access = useCleaningAccess();
  const serviceName = useServiceName();
  const f = t.fields;
  const { payment, suspension } = mission;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <BackLink href={cleaningPaths.missions}>{t.back}</BackLink>
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h2">
            {t.title(serviceName(mission.serviceCode))}
          </Heading>
          <StatusBadge map={missionStatuses} code={mission.status} />
        </div>
        <p className="text-ink-muted">{`${mission.commune} · ${formatSlot(mission.chosenSlot)}`}</p>
      </div>

      {suspension ? <SuspensionNotice suspension={suspension} /> : null}

      {access?.supervise ? (
        <Panel title={t.actions} id="mission-actions">
          <Actions mission={mission} onChange={onChange} />
        </Panel>
      ) : null}

      <Panel title={t.interventions} id="mission-passages">
        {mission.interventions.length ? (
          <ul className="grid gap-3">
            {mission.interventions.map((intervention) => (
              <li
                key={intervention.id}
                className="rounded-card border-line has-[.stretched-link:focus-visible]:outline-focus relative grid gap-1 border p-4 has-[.stretched-link:focus-visible]:outline-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={cleaningPaths.intervention(mission.id, intervention.id)}
                    className="stretched-link text-ink font-semibold hover:underline"
                  >
                    {t.openIntervention(formatDateTime(intervention.scheduledStart))}
                  </Link>
                  <StatusBadge map={interventionStatuses} code={intervention.status} />
                </div>
                <p className="text-small text-ink-muted">
                  {formatDuration(intervention.durationMinutes)}
                  {intervention.agents.length
                    ? ` · ${t.agents(intervention.agents.map((agent) => agent.displayName).join(', '))}`
                    : ''}
                </p>
                {intervention.incidentNote ? (
                  <p className="text-small text-danger">{intervention.incidentNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Note>{t.noIntervention}</Note>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.summary} id="mission-resume">
          <DescriptionList
            items={[
              { term: f.address, value: mission.address },
              { term: f.commune, value: mission.commune },
              { term: f.slot, value: formatSlot(mission.chosenSlot) },
              { term: f.recurrence, value: mission.recurrence ? recurrenceText(mission.recurrence) : null },
              { term: f.daysPerWeek, value: mission.daysPerWeek },
              {
                term: f.progress,
                value: `${mission.completedInterventions} / ${mission.plannedInterventions}`,
              },
              { term: f.kind, value: mission.customerKind ? customerKind(mission.customerKind) : null },
              { term: f.customerName, value: nameOr(mission.customerName, common.unnamed) },
              {
                term: f.organizationName,
                value: mission.organizationId
                  ? nameOr(mission.organizationName, common.unnamedBusiness)
                  : null,
              },
              {
                term: f.request,
                value: access?.supervise ? (
                  <Link href={cleaningPaths.request(mission.requestId)} className="text-accent-ink underline">
                    {formatDateTime(mission.createdAt)}
                  </Link>
                ) : null,
              },
              { term: f.cancellationReason, value: mission.cancellationReason },
            ]}
          />
        </Panel>

        <Panel
          title={t.payment}
          id="mission-paiement"
          action={<StatusBadge map={paymentStatuses} code={payment.status} />}
        >
          <DescriptionList
            items={[
              {
                term: t.paymentFields.plan,
                value: `${paymentOption(payment.plan.option)}, ${paymentTiming(payment.plan.timing)}, ${paymentMethod(payment.plan.method)}`,
              },
              { term: t.paymentFields.total, value: formatXof(payment.total) },
              {
                term: t.paymentFields.deposit,
                value: `${formatXof(payment.depositAmount)} (${payment.depositPercent} %)`,
              },
              { term: t.paymentFields.paid, value: <strong>{formatXof(payment.paid)}</strong> },
            ]}
          />
          <div className="grid gap-2">
            <p className="text-small text-ink font-semibold">{t.payments}</p>
            {payment.payments.length ? (
              <ul className="grid gap-2">
                {payment.payments.map((record) => (
                  <li key={record.id} className="border-line border-t pt-2">
                    <p className="text-ink font-medium tabular-nums">
                      {formatXof(record.amount)}
                      {record.reference ? ` · ${record.reference}` : ''}
                    </p>
                    <p className="text-small text-ink-muted">
                      {t.paymentLine(
                        paymentMethod(record.method),
                        nameOr(record.recordedByName, common.someone),
                        formatDateTime(record.recordedAt),
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Note>{t.noPayment}</Note>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Fiche d'une mission : passages, agents, paiements, et actions selon l'état et les rôles. */
export function MissionDetail({ id }: { id: string }) {
  const mission = useResource(useCallback(() => getMission(id), [id]));
  return (
    <ResourceView resource={mission} lines={6}>
      {(data) => <MissionView mission={data} onChange={mission.set} />}
    </ResourceView>
  );
}
