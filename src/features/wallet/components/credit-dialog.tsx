'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, newIdempotencyKey } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import {
  creditWallet,
  type CreditRequest,
  type HolderType,
  listMismatchedTopUps,
} from '@/features/wallet/api';
import type { MismatchedTopUp, WalletCredit } from '@/features/wallet/schemas';
import { walletTexts } from '@/features/wallet/texts';

const t = walletTexts.credit;

type Kind = CreditRequest['kind'];
type Field = 'amount' | 'reason' | 'paymentId';
interface Draft {
  kind: Kind;
  amount: string;
  reason: string;
  paymentId: string;
}
type TopUps = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; items: MismatchedTopUp[] };

const EMPTY: Draft = { kind: 'refund', amount: '', reason: '', paymentId: '' };
const REASON_MAX = 200;

/** Montant saisi (espaces tolérés) en entier de FCFA, ou `null` s'il n'en est pas un. */
function parseAmount(raw: string): number | null {
  const compact = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/** Contrôles locaux avant la confirmation ; la gateway reste juge (`WALLET_VALIDATION_FAILED`). */
function validate(draft: Draft): { request: CreditRequest | null; errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  const amount = parseAmount(draft.amount);
  const reason = draft.reason.trim();
  const paymentId = draft.paymentId.trim();
  if (draft.kind === 'top_up' && !paymentId) errors.paymentId = t.paymentRequired;
  if (amount === null) errors.amount = t.invalidAmount;
  if (!reason) errors.reason = t.reasonRequired;
  if (Object.keys(errors).length || amount === null) return { request: null, errors };
  return {
    request:
      draft.kind === 'top_up'
        ? { kind: 'top_up', amount, reason, paymentId }
        : { kind: 'refund', amount, reason },
    errors,
  };
}

function Choice({
  name,
  value,
  checked,
  label,
  hint,
  onChange,
}: {
  name: string;
  value: Kind;
  checked: boolean;
  label: string;
  hint: string;
  onChange: (kind: Kind) => void;
}) {
  const id = `${name}-${value}`;
  return (
    <div className="rounded-control border-line-control has-[:checked]:border-action has-[:checked]:bg-action-soft flex min-h-11 items-start gap-3 border p-3">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        aria-describedby={`${id}-aide`}
        className="accent-action mt-1 size-5 shrink-0"
      />
      <label htmlFor={id} className="grid gap-1">
        <span className="text-ink font-semibold">{label}</span>
        <span id={`${id}-aide`} className="text-small text-ink-muted">
          {hint}
        </span>
      </label>
    </div>
  );
}

/** Choix de la recharge en écart : liste du client si elle a pu être lue, sinon saisie de l'identifiant. */
function PaymentChoice({
  topUps,
  value,
  error,
  onChange,
}: {
  topUps: TopUps;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  if (topUps.status === 'loading' || topUps.status === 'idle') {
    return (
      <p role="status" className="text-small text-ink-muted">
        {t.paymentsLoading}
      </p>
    );
  }
  if (topUps.status === 'ready' && topUps.items.length) {
    return (
      <SelectField
        id="credit-paiement"
        label={t.payment}
        hint={t.paymentHint}
        value={value}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {topUps.items.map((item) => (
          <option key={item.id} value={item.id}>
            {t.paymentOption(formatDateTime(item.createdAt), formatXof(item.amount), item.providerReference)}
            {item.underReview ? t.toReview : ''}
          </option>
        ))}
      </SelectField>
    );
  }
  return (
    <TextField
      id="credit-paiement"
      label={t.paymentId}
      hint={topUps.status === 'error' ? t.paymentsUnavailable : t.noPayments}
      value={value}
      error={error}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * « Créditer ou rembourser » (finance, ADR-046) : formulaire (type, recharge en écart, montant, motif),
 * puis récapitulatif à confirmer, car l'écriture est définitive. `<dialog>` modal natif. Clé
 * d'idempotence tirée à l'ouverture et renvoyée telle quelle à chaque nouvel essai : un envoi répété
 * ne crédite qu'une fois.
 */
export function CreditDialog({
  type,
  holderId,
  holderLabel,
  onCredited,
}: {
  type: HolderType;
  holderId: string;
  holderLabel: string;
  onCredited: (credit: WalletCredit) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const key = useRef('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [topUps, setTopUps] = useState<TopUps>({ status: 'idle' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { request } = validate(draft);

  function open() {
    key.current = newIdempotencyKey();
    setDraft(EMPTY);
    setStep('form');
    setErrors({});
    setError(null);
    ref.current?.showModal();
  }

  function close() {
    if (!pending) ref.current?.close();
  }

  function change(patch: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
  }

  function chooseKind(kind: Kind) {
    change({ kind });
    if (kind === 'top_up' && topUps.status === 'idle') {
      setTopUps({ status: 'loading' });
      listMismatchedTopUps(holderId).then(
        (items) => setTopUps({ status: 'ready', items }),
        () => setTopUps({ status: 'error' }),
      );
    }
  }

  function review() {
    const result = validate(draft);
    setErrors(result.errors);
    const first = (['paymentId', 'amount', 'reason'] as const).find((field) => result.errors[field]);
    if (first) {
      document.getElementById(`credit-${first === 'paymentId' ? 'paiement' : first}`)?.focus();
      return;
    }
    setStep('review');
  }

  async function send() {
    if (!request || pending) return;
    setPending(true);
    setError(null);
    try {
      const credit = await creditWallet(type, holderId, request, key.current);
      ref.current?.close();
      onCredited(credit);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.code === 'WALLET_IDEMPOTENCY_KEY_REUSED'
          ? request.kind === 'top_up'
            ? t.reusedTopUp
            : t.reused
          : apiErrorText(caught),
      );
    } finally {
      setPending(false);
    }
  }

  const amount = request ? formatXof(request.amount) : '';

  return (
    <>
      <Button variant="action" onClick={open}>
        {t.open}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-titre`}
        aria-describedby={`${id}-texte`}
        onCancel={(event) => {
          event.preventDefault();
          if (step === 'review') {
            if (!pending) setStep('form');
          } else close();
        }}
        className="rounded-card bg-surface text-ink shadow-raised backdrop:bg-brand-950/45 m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain p-0"
      >
        {step === 'form' ? (
          <form
            noValidate
            className="grid gap-4 p-5 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            <h2 id={`${id}-titre`} className="font-display text-h3 font-semibold">
              {t.title}
            </h2>
            <p id={`${id}-texte`} className="text-ink-muted">
              {t.lead}
            </p>
            <fieldset className="grid gap-2">
              <legend className="text-ink mb-2 font-semibold">{t.kind}</legend>
              <Choice
                name={`${id}-type`}
                value="refund"
                checked={draft.kind === 'refund'}
                label={t.refund}
                hint={t.refundHint}
                onChange={chooseKind}
              />
              <Choice
                name={`${id}-type`}
                value="top_up"
                checked={draft.kind === 'top_up'}
                label={t.topUp}
                hint={t.topUpHint}
                onChange={chooseKind}
              />
            </fieldset>
            {draft.kind === 'top_up' ? (
              <PaymentChoice
                topUps={topUps}
                value={draft.paymentId}
                error={errors.paymentId}
                onChange={(paymentId) => change({ paymentId })}
              />
            ) : null}
            <TextField
              id="credit-amount"
              label={t.amount}
              hint={draft.kind === 'top_up' ? t.amountReceivedHint : t.amountHint}
              inputMode="numeric"
              autoComplete="off"
              value={draft.amount}
              error={errors.amount}
              onChange={(event) => change({ amount: event.target.value })}
            />
            <TextAreaField
              id="credit-reason"
              label={t.reason}
              hint={t.reasonHint}
              rows={3}
              maxLength={REASON_MAX}
              value={draft.reason}
              error={errors.reason}
              onChange={(event) => change({ reason: event.target.value })}
            />
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={close}>
                {t.cancel}
              </Button>
              <Button type="submit" variant="action">
                {t.review}
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 p-5 sm:p-6">
            <h2 id={`${id}-titre`} className="font-display text-h3 font-semibold">
              {t.reviewTitle}
            </h2>
            <p id={`${id}-texte`} className="text-ink-muted">
              {t.reviewLead}
            </p>
            {request ? (
              <DescriptionList
                items={[
                  { term: t.holder, value: holderLabel },
                  { term: t.kind, value: request.kind === 'top_up' ? t.topUp : t.refund },
                  {
                    term: t.amount,
                    value: <strong className="tabular-nums">{amount}</strong>,
                  },
                  { term: t.reason, value: request.reason },
                  {
                    term: t.paymentId,
                    value:
                      request.kind === 'top_up' ? (
                        <span className="break-all">{request.paymentId}</span>
                      ) : null,
                  },
                ]}
              />
            ) : null}
            <FormMessage>{error}</FormMessage>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" disabled={pending} onClick={() => setStep('form')}>
                {t.back}
              </Button>
              <Button variant="action" aria-busy={pending || undefined} disabled={pending} onClick={send}>
                {pending ? t.pending : t.confirm(amount)}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
