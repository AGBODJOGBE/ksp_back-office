'use client';

import { useState } from 'react';
import { TextField } from '@/components/ui/field';
import { parseInteger } from '@/features/cleaning/inputs';
import { quoteTexts } from '@/features/cleaning/quote-texts';
import { createQuote, type QuoteDraftBody, updateQuoteDraft } from '@/features/cleaning/requests-api';
import type { Quote } from '@/features/cleaning/requests-schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { FieldGroup } from './editors';
import {
  type AdjustmentDraft,
  adjustmentDrafts,
  adjustmentErrors,
  AdjustmentsEditor,
  adjustmentsBody,
} from './request-quote-adjustments';
import { type StepProps, useKeyed } from './request-parts';
import { type FieldErrors, FormFooter, Note, useFormSubmit } from './parts';

const t = quoteTexts.form;
const FIELDS = ['teamSize', 'durationMinutes', 'validityDays', 'adjustments', 'onQuotePrices'] as const;

/** Bornes des champs entiers facultatifs (contrat). */
const RANGES = {
  teamSize: [1, 50],
  durationMinutes: [15, 1440],
  validityDays: [1, 90],
} as const;
type IntField = keyof typeof RANGES;

/**
 * Composer un brouillon de devis (ou une révision du devis envoyé), ou modifier le brouillon `draft`.
 * Champ vide : valeur proposée par le calcul retenu ou par les réglages. Le programme reste celui de
 * la demande (son ajustement est hors de ce lot, à valider).
 */
export function QuoteForm({
  request,
  access,
  draft,
  onDone,
}: StepProps & { draft: Quote | null; onDone: () => void }) {
  const keyed = useKeyed();
  const form = useFormSubmit(FIELDS);
  const canAdjust = access['cleaning.quote.adjust_price'];
  const onQuote = (request.retained?.pricing.offers ?? []).filter((offer) => offer.status === 'on_quote');
  const [ints, setInts] = useState<Record<IntField, string>>({
    teamSize: draft ? String(draft.teamSize) : '',
    durationMinutes: draft ? String(draft.durationMinutes) : '',
    validityDays: '',
  });
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      onQuote.map((offer) => {
        const line = draft?.lines.find((item) => item.offerId === offer.offerId);
        return [offer.offerId, line?.unitPrice ? String(line.unitPrice.amount) : ''];
      }),
    ),
  );
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>(() =>
    draft ? adjustmentDrafts(draft.adjustments) : [],
  );
  const revision = !draft && request.currentQuote?.status === 'sent';

  function validate(): FieldErrors {
    const errors: FieldErrors = canAdjust ? adjustmentErrors(adjustments) : {};
    for (const [field, [min, max]] of Object.entries(RANGES) as [IntField, readonly [number, number]][]) {
      const raw = ints[field].trim();
      const value = raw ? parseInteger(raw) : undefined;
      if (value === null || (value !== undefined && (value < min || value > max)))
        errors[field] = t.range(min, max);
    }
    onQuote.forEach((offer, index) => {
      const raw = (prices[offer.offerId] ?? '').trim();
      const value = raw ? parseInteger(raw) : undefined;
      if (value === null || value === 0)
        errors[`onQuotePrices[${index}].price`] = cleaningTexts.common.invalidAmount;
    });
    return errors;
  }

  function body(): QuoteDraftBody {
    const value = (field: IntField) =>
      ints[field].trim() ? (parseInteger(ints[field]) as number) : undefined;
    const fixed = onQuote.flatMap((offer) => {
      const amount = parseInteger(prices[offer.offerId] ?? '');
      return amount ? [{ offerId: offer.offerId, price: { amount, currency: 'XOF' as const } }] : [];
    });
    return {
      teamSize: value('teamSize'),
      durationMinutes: value('durationMinutes'),
      validityDays: value('validityDays'),
      onQuotePrices: onQuote.length ? fixed : undefined,
      adjustments: canAdjust ? adjustmentsBody(adjustments) : undefined,
    };
  }

  async function send() {
    if (draft) await updateQuoteDraft(draft.id, body());
    else await keyed((key) => createQuote(request.id, body(), key));
    onDone();
  }

  const intField = (field: IntField, label: string, hint: string) => (
    <TextField
      id={`devis-${field}`}
      label={label}
      hint={hint}
      inputMode="numeric"
      value={ints[field]}
      error={form.errors[field]}
      onChange={(event) => setInts((current) => ({ ...current, [field]: event.target.value }))}
    />
  );

  return (
    <form
      noValidate
      aria-label={draft ? t.edit : revision ? t.revise : t.create}
      onSubmit={(event) => void form.submit(event, validate(), send)}
      className="rounded-control bg-surface-muted grid gap-4 p-3 sm:p-4"
    >
      <h3 className="text-ink font-semibold">{draft ? t.edit : revision ? t.revise : t.create}</h3>
      {revision ? <Note>{t.reviseHint}</Note> : null}
      <Note>{t.schedule}</Note>
      <div className="grid gap-4 sm:grid-cols-3">
        {intField('teamSize', t.teamSize, t.teamSizeHint)}
        {intField('durationMinutes', t.duration, t.durationHint)}
        {intField('validityDays', t.validity, t.validityHint)}
      </div>
      {onQuote.length ? (
        <FieldGroup id="devis-sur-devis" legend={t.onQuote} hint={t.onQuoteHint}>
          <div className="grid gap-4 sm:grid-cols-2">
            {onQuote.map((offer, index) => (
              <TextField
                key={offer.offerId}
                id={`devis-prix-${offer.offerId}`}
                label={t.onQuotePrice(offer.name)}
                inputMode="numeric"
                value={prices[offer.offerId] ?? ''}
                error={form.errors[`onQuotePrices[${index}].price`] ?? form.errors[`onQuotePrices[${index}]`]}
                onChange={(event) =>
                  setPrices((current) => ({ ...current, [offer.offerId]: event.target.value }))
                }
              />
            ))}
          </div>
        </FieldGroup>
      ) : null}
      {canAdjust ? (
        <AdjustmentsEditor drafts={adjustments} errors={form.errors} onChange={setAdjustments} />
      ) : (
        <Note>{t.adjustmentsReserved}</Note>
      )}
      <FormFooter
        pending={form.pending}
        message={form.message}
        label={draft ? t.submitEdit : t.submitCreate}
      />
    </form>
  );
}
