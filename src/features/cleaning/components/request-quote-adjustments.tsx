'use client';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { parseInteger, parsePercentBps, percentInput } from '@/features/cleaning/inputs';
import { quoteTexts } from '@/features/cleaning/quote-texts';
import type { AdjustmentInput } from '@/features/cleaning/requests-api';
import type { QuoteAdjustment } from '@/features/cleaning/requests-schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { FieldGroup, RowFrame } from './editors';
import { MAX_REASON } from './request-parts';
import type { FieldErrors } from './parts';

const t = quoteTexts.form;
const c = cleaningTexts.common;
/** Cinq ajustements au plus par devis (contrat). */
export const MAX_ADJUSTMENTS = 5;

export interface AdjustmentDraft {
  kind: 'discount' | 'surcharge';
  mode: 'percent' | 'fixed';
  value: string;
  reason: string;
}

export const emptyAdjustment = (): AdjustmentDraft => ({
  kind: 'discount',
  mode: 'percent',
  value: '',
  reason: '',
});

/** Ajustements d'un brouillon en saisie ; un montant fixe masqué reste vide (à ressaisir). */
export const adjustmentDrafts = (adjustments: readonly QuoteAdjustment[]): AdjustmentDraft[] =>
  adjustments.map((adjustment) =>
    adjustment.percentBps !== null
      ? {
          kind: adjustment.kind,
          mode: 'percent',
          value: percentInput(adjustment.percentBps),
          reason: adjustment.reason,
        }
      : {
          kind: adjustment.kind,
          mode: 'fixed',
          value: adjustment.fixedAmount ? String(adjustment.fixedAmount.amount) : '',
          reason: adjustment.reason,
        },
  );

/** Contrôles locaux, clés `adjustments[i].<champ>` (chemins du contrat). */
export function adjustmentErrors(drafts: readonly AdjustmentDraft[]): FieldErrors {
  const errors: FieldErrors = {};
  drafts.forEach((draft, index) => {
    const field = `adjustments[${index}]`;
    if (draft.mode === 'percent') {
      const bps = parsePercentBps(draft.value);
      if (bps === null || bps < 1 || bps > 10_000) errors[`${field}.percentBps`] = t.percentRange;
    } else {
      const amount = parseInteger(draft.value);
      if (amount === null || amount < 1) errors[`${field}.fixedAmount`] = c.invalidAmount;
    }
    const reason = draft.reason.trim();
    if (!reason) errors[`${field}.reason`] = c.required;
    else if (reason.length > MAX_REASON) errors[`${field}.reason`] = c.tooLong(MAX_REASON);
  });
  return errors;
}

export const adjustmentsBody = (drafts: readonly AdjustmentDraft[]): AdjustmentInput[] =>
  drafts.map((draft) => ({
    kind: draft.kind,
    ...(draft.mode === 'percent'
      ? { percentBps: parsePercentBps(draft.value) ?? 0 }
      : { fixedAmount: { amount: parseInteger(draft.value) ?? 0, currency: 'XOF' as const } }),
    reason: draft.reason.trim(),
  }));

/** Remises et majorations d'un devis : nature, calcul (pourcentage ou montant fixe), motif. */
export function AdjustmentsEditor({
  drafts,
  errors,
  onChange,
}: {
  drafts: readonly AdjustmentDraft[];
  errors: FieldErrors;
  onChange: (drafts: AdjustmentDraft[]) => void;
}) {
  const update = (index: number, change: Partial<AdjustmentDraft>) =>
    onChange(drafts.map((draft, rank) => (rank === index ? { ...draft, ...change } : draft)));
  return (
    <FieldGroup id="devis-ajustements" legend={t.adjustments} hint={t.adjustmentsHint}>
      {drafts.map((draft, index) => {
        const id = `devis-ajustement-${index}`;
        const field = `adjustments[${index}]`;
        return (
          <RowFrame
            key={id}
            id={id}
            title={t.adjustment(index + 1)}
            onRemove={() => onChange(drafts.filter((_, rank) => rank !== index))}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id={`${id}-nature`}
                label={t.kind}
                value={draft.kind}
                onChange={(event) => update(index, { kind: event.target.value as AdjustmentDraft['kind'] })}
              >
                <option value="discount">{quoteTexts.adjustmentKinds.discount}</option>
                <option value="surcharge">{quoteTexts.adjustmentKinds.surcharge}</option>
              </SelectField>
              <SelectField
                id={`${id}-calcul`}
                label={t.mode}
                value={draft.mode}
                onChange={(event) =>
                  update(index, { mode: event.target.value as AdjustmentDraft['mode'], value: '' })
                }
              >
                <option value="percent">{t.modes.percent}</option>
                <option value="fixed">{t.modes.fixed}</option>
              </SelectField>
              <TextField
                id={`${id}-valeur`}
                label={draft.mode === 'percent' ? t.percent : t.amount}
                inputMode={draft.mode === 'percent' ? 'decimal' : 'numeric'}
                value={draft.value}
                error={errors[`${field}.${draft.mode === 'percent' ? 'percentBps' : 'fixedAmount'}`]}
                onChange={(event) => update(index, { value: event.target.value })}
              />
              <TextField
                id={`${id}-motif`}
                label={t.reason}
                maxLength={MAX_REASON}
                value={draft.reason}
                error={errors[`${field}.reason`]}
                onChange={(event) => update(index, { reason: event.target.value })}
              />
            </div>
          </RowFrame>
        );
      })}
      {drafts.length < MAX_ADJUSTMENTS ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...drafts, emptyAdjustment()])}
        >
          {t.addAdjustment}
        </Button>
      ) : null}
    </FieldGroup>
  );
}
