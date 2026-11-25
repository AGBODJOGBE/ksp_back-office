'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage, TextField } from '@/components/ui/field';
import { TextAreaField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, newIdempotencyKey } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { issueCreditNote } from '@/features/billing/api';
import {
  type CreditNoteDraft,
  type CreditNoteErrors,
  firstInvalidField,
  LABEL_MAX,
  MAX_LINES,
  REASON_MAX,
  splitPreview,
  validateCreditNote,
} from '@/features/billing/credit-note-form';
import { creditNoteTexts } from '@/features/billing/credit-note-texts';
import type { CreditNoteIssued, Invoice } from '@/features/billing/schemas';

const t = creditNoteTexts.issue;
const NO_ERRORS: CreditNoteErrors = { lines: {} };
const emptyDraft = (): CreditNoteDraft => ({ lines: [{ key: 0, label: '', amount: '' }], reason: '' });

/** Refus métier : message lisible, et faut-il relire la facture ? */
function issueError(error: unknown): { message: string; stale: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'BILLING_CREDIT_NOTE_EXCEEDS_INVOICE')
      return { message: creditNoteTexts.errors.exceeds, stale: true };
    if (error.code === 'BILLING_INVALID_TRANSITION')
      return { message: creditNoteTexts.errors.cancelled, stale: true };
    if (error.code === 'BILLING_IDEMPOTENCY_KEY_REUSED')
      return { message: creditNoteTexts.errors.reused, stale: false };
  }
  return { message: apiErrorText(error), stale: false };
}

/**
 * Émission d'un avoir depuis la fiche d'une facture (R-PE-07) : lignes positives et motif, total au plus
 * égal à ce qui reste possible en avoir, puis confirmation (imputation prévue sur le reste dû et part
 * créditée au portefeuille). Clé d'idempotence tirée à l'ouverture, renvoyée telle quelle à chaque essai.
 */
export function CreditNoteDialog({
  invoice,
  max,
  onIssued,
  onStale,
}: {
  invoice: Invoice;
  /** Ce qui reste possible en avoir (FCFA). */
  max: number;
  onIssued: (issued: CreditNoteIssued) => void;
  /** Facture changée entre-temps : message gardé sur la fiche, qui est relue (la boîte peut disparaître). */
  onStale: (message: string) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const key = useRef('');
  const nextKey = useRef(1);
  const [draft, setDraft] = useState<CreditNoteDraft>(emptyDraft);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [errors, setErrors] = useState<CreditNoteErrors>(NO_ERRORS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { request } = validateCreditNote(draft, max);

  function open() {
    key.current = newIdempotencyKey();
    nextKey.current = 1;
    setDraft(emptyDraft());
    setStep('form');
    setErrors(NO_ERRORS);
    setError(null);
    ref.current?.showModal();
  }

  function close() {
    if (!pending) ref.current?.close();
  }

  function update(change: (draft: CreditNoteDraft) => CreditNoteDraft) {
    setDraft(change);
    setError(null);
  }

  const setLine = (lineKey: number, patch: { label?: string; amount?: string }) =>
    update((d) => ({
      ...d,
      lines: d.lines.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)),
    }));

  function review() {
    const result = validateCreditNote(draft, max);
    setErrors(result.errors);
    const first = firstInvalidField(draft, result.errors);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setStep('review');
  }

  async function send() {
    if (!request || pending) return;
    setPending(true);
    setError(null);
    try {
      const issued = await issueCreditNote(invoice.id, request, key.current);
      ref.current?.close();
      onIssued(issued);
    } catch (caught) {
      const { message, stale } = issueError(caught);
      setError(message);
      if (stale) onStale(message);
    } finally {
      setPending(false);
    }
  }

  const total = request ? formatXof(request.total) : '';
  const split = request ? splitPreview(request.total, invoice.balance.amount) : null;

  return (
    <>
      <Button variant="secondary" onClick={open}>
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
        className="rounded-card bg-surface text-ink shadow-raised backdrop:bg-brand-950/45 m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain p-0"
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
              {t.lead} {t.max(formatXof(max))}
            </p>
            {draft.lines.map((line, index) => (
              <fieldset key={line.key} className="border-line rounded-control grid gap-3 border p-3">
                <legend className="text-ink px-1 font-semibold">{t.lineLegend(index + 1)}</legend>
                <TextField
                  id={`avoir-libelle-${line.key}`}
                  label={t.label}
                  hint={t.labelHint}
                  maxLength={LABEL_MAX}
                  autoComplete="off"
                  value={line.label}
                  error={errors.lines[line.key]?.label}
                  onChange={(event) => setLine(line.key, { label: event.target.value })}
                />
                <TextField
                  id={`avoir-montant-${line.key}`}
                  label={t.amount}
                  hint={t.amountHint}
                  inputMode="numeric"
                  autoComplete="off"
                  value={line.amount}
                  error={errors.lines[line.key]?.amount}
                  onChange={(event) => setLine(line.key, { amount: event.target.value })}
                />
                {draft.lines.length > 1 ? (
                  <Button
                    variant="ghost"
                    className="justify-self-start"
                    onClick={() =>
                      update((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== line.key) }))
                    }
                  >
                    {t.removeLine(index + 1)}
                  </Button>
                ) : null}
              </fieldset>
            ))}
            {draft.lines.length < MAX_LINES ? (
              <Button
                variant="secondary"
                className="justify-self-start"
                onClick={() => {
                  const lineKey = nextKey.current++;
                  update((d) => ({ ...d, lines: [...d.lines, { key: lineKey, label: '', amount: '' }] }));
                }}
              >
                {t.addLine}
              </Button>
            ) : null}
            <TextAreaField
              id="avoir-motif"
              label={t.reason}
              hint={t.reasonHint}
              rows={3}
              maxLength={REASON_MAX}
              value={draft.reason}
              error={errors.reason}
              onChange={(event) => update((d) => ({ ...d, reason: event.target.value }))}
            />
            <FormMessage>{errors.total}</FormMessage>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={close}>
                {creditNoteTexts.cancel}
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
                  ...request.lines.map((line, index) => ({
                    term: `${t.lineLegend(index + 1)} · ${line.label}`,
                    value: <span className="tabular-nums">{formatXof(line.amount)}</span>,
                  })),
                  { term: t.total, value: <strong className="tabular-nums">{total}</strong> },
                  { term: t.reason, value: request.reason },
                ]}
              />
            ) : null}
            {split ? (
              <p className="text-small text-ink-muted">
                {t.split(formatXof(split.applied), formatXof(split.credited))}
              </p>
            ) : null}
            <FormMessage>{error}</FormMessage>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" disabled={pending} onClick={() => setStep('form')}>
                {t.back}
              </Button>
              <Button variant="action" aria-busy={pending || undefined} disabled={pending} onClick={send}>
                {pending ? creditNoteTexts.pending : t.confirm(total)}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
