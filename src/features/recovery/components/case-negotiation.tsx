'use client';

import { useState } from 'react';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { formatDate, formatXof } from '@/lib/format';
import { caseActionTexts } from '@/features/recovery/case-action-texts';
import { estimatePlan } from '@/features/recovery/case-logic';
import { type Case, PLAN_RHYTHMS, type PlanRhythm } from '@/features/recovery/case-schemas';
import { rhythmLabel, settlementStatusLabel } from '@/features/recovery/case-texts';
import { proposePlan, proposeSettlement } from '@/features/recovery/cases-api';
import { attempt } from '@/features/recovery/errors';
import { formatBps, recoveryTexts } from '@/features/recovery/texts';
import { confirmLabels, field, idempotent, type OnDone, positiveAmount } from './case-action-parts';
import { useIdempotencyKey } from './parts';

const t = caseActionTexts;
const c = recoveryTexts.common;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (value: string) => formatDate(`${value}T12:00:00+01:00`);

/** Champs de l'échéancier et estimation locale face au barème (indicative). */
function PlanFields({ item }: { item: Case }) {
  const [values, setValues] = useState({ first: '', date: '', rhythm: 'monthly' as PlanRhythm, count: '' });
  const change = (patch: Partial<typeof values>) => setValues((current) => ({ ...current, ...patch }));
  const first = Number(values.first.replace(/\s/g, ''));
  const count = Number(values.count);
  const ready =
    /^\d{1,13}$/.test(values.first.replace(/\s/g, '')) && DAY.test(values.date) && count >= 1 && count <= 52;
  const estimate = ready
    ? estimatePlan(item.amounts.due.amount, item.planScale, {
        firstAmount: first,
        firstDueDate: values.date,
        rhythm: values.rhythm,
        installmentsCount: count,
      })
    : null;
  const xof = (amount: number) => formatXof({ amount, currency: 'XOF' });
  return (
    <>
      {item.planScale.acceptsPaymentPlan ? null : <p className="text-small text-warning">{t.plan.noScale}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="echeancier-premier"
          name="firstAmount"
          inputMode="numeric"
          label={t.plan.firstAmount}
          value={values.first}
          onChange={(event) => change({ first: event.target.value })}
        />
        <TextField
          id="echeancier-date"
          name="firstDueDate"
          type="date"
          label={t.plan.firstDueDate}
          value={values.date}
          onChange={(event) => change({ date: event.target.value })}
        />
        <SelectField
          id="echeancier-rythme"
          name="rhythm"
          label={t.plan.rhythm}
          value={values.rhythm}
          onChange={(event) => change({ rhythm: event.target.value as PlanRhythm })}
        >
          {PLAN_RHYTHMS.map((value) => (
            <option key={value} value={value}>
              {rhythmLabel(value)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="echeancier-nombre"
          name="installmentsCount"
          inputMode="numeric"
          label={t.plan.count}
          hint={t.plan.countHint}
          value={values.count}
          onChange={(event) => change({ count: event.target.value })}
        />
      </div>
      {estimate ? (
        <section
          aria-label={t.plan.estimate}
          className="rounded-control bg-surface-muted text-small grid gap-1 p-4"
        >
          <p className="font-semibold">{t.plan.estimate}</p>
          <p>{t.plan.rest(xof(estimate.rest))}</p>
          <p>{t.plan.perInstallment(xof(estimate.installment))}</p>
          <p>{t.plan.last(day(estimate.lastDueDate))}</p>
          {estimate.issues.length ? (
            <ul className="text-danger list-disc pl-5">
              {estimate.issues.includes('first_payment') ? (
                <li>{t.plan.issue.first_payment(xof(estimate.firstMinimum), day(estimate.firstLatest))}</li>
              ) : null}
              {estimate.issues.includes('installment_minimum') ? (
                <li>{t.plan.issue.installment_minimum(formatXof(item.planScale.minInstallment))}</li>
              ) : null}
              {estimate.issues.includes('duration') ? (
                <li>{t.plan.issue.duration(day(estimate.durationLimit))}</li>
              ) : null}
            </ul>
          ) : (
            <p>{t.plan.withinEstimate}</p>
          )}
          <p className="text-ink-muted">{t.plan.estimateNote}</p>
        </section>
      ) : null}
      <TextAreaField id="echeancier-note" name="note" label={t.noteOptional} maxLength={1000} />
    </>
  );
}

/** Proposer un échéancier (R-EC-01) et une remise (R-PR-05) : idempotents (contrat). */
export function CaseNegotiation({ item, onDone }: { item: Case; onDone: OnDone }) {
  const planKey = useIdempotencyKey();
  const settlementKey = useIdempotencyKey();
  const [payNow, setPayNow] = useState('');
  const due = item.amounts.due.amount;
  const pay = Number(payNow.replace(/\s/g, ''));
  const discount = due > 0 && pay > 0 && pay < due ? Math.round(((due - pay) / due) * 10_000) : null;

  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmAction
        label={t.plan.open}
        title={t.plan.title}
        description={t.plan.text}
        confirmLabel={t.plan.open}
        labels={confirmLabels}
        onConfirm={(data) => {
          const firstAmount = positiveAmount(data, 'firstAmount');
          if (firstAmount === null) return Promise.resolve(c.invalidAmount);
          const firstDueDate = field(data, 'firstDueDate');
          if (!DAY.test(firstDueDate)) return Promise.resolve(t.promise.invalidDate);
          const count = field(data, 'installmentsCount');
          if (!/^\d{1,2}$/.test(count) || Number(count) < 1 || Number(count) > 52) {
            return Promise.resolve(t.plan.invalidCount);
          }
          const note = field(data, 'note');
          return attempt(async () => {
            const plan = await idempotent(planKey, (key) =>
              proposePlan(
                item.id,
                {
                  firstAmount,
                  firstDueDate,
                  rhythm: field(data, 'rhythm') as PlanRhythm,
                  installmentsCount: Number(count),
                  ...(note ? { note } : {}),
                },
                key,
              ),
            );
            onDone(plan.withinScale ? t.plan.within : t.plan.outside);
          });
        }}
      >
        <PlanFields item={item} />
      </ConfirmAction>

      <ConfirmAction
        label={t.settlement.open}
        title={t.settlement.title}
        description={t.settlement.text}
        confirmLabel={t.settlement.open}
        labels={confirmLabels}
        onConfirm={(data) => {
          const amount = positiveAmount(data, 'payNow');
          if (amount === null) return Promise.resolve(c.invalidAmount);
          if (amount >= due) return Promise.resolve(t.settlement.tooHigh);
          const validUntil = field(data, 'validUntil');
          if (!DAY.test(validUntil)) return Promise.resolve(t.settlement.invalidDate);
          return attempt(async () => {
            const settlement = await idempotent(settlementKey, (key) =>
              proposeSettlement(item.id, amount, `${validUntil}T23:59:00+01:00`, field(data, 'note'), key),
            );
            onDone(t.settlement.saved(settlementStatusLabel(settlement.status)));
          });
        }}
      >
        <TextField
          id="remise-montant"
          name="payNow"
          inputMode="numeric"
          label={t.settlement.payNow}
          value={payNow}
          onChange={(event) => setPayNow(event.target.value)}
          hint={
            discount === null
              ? undefined
              : t.settlement.discount(formatBps(discount), formatBps(item.planScale.maxDiscountBps))
          }
        />
        <TextField id="remise-date" name="validUntil" type="date" label={t.settlement.validUntil} />
        <TextAreaField id="remise-note" name="note" label={t.noteOptional} maxLength={1000} />
      </ConfirmAction>
    </div>
  );
}
