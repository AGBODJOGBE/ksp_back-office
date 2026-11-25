'use client';

import { Button } from '@/components/ui/button';
import { FieldError, TextField } from '@/components/ui/field';
import { formatXof } from '@/lib/format';
import { editorTexts } from '@/features/recovery/pricing-editor-texts';
import {
  MAX_TIERS,
  parseAmount,
  parsePercent,
  type TierValues,
  tiersAreRates,
} from '@/features/recovery/pricing-form';
import type { PricingObject } from '@/features/recovery/pricing-schemas';
import { formatBps } from '@/features/recovery/texts';

const t = editorTexts.tiers;

/** Phrase lisible d'une tranche saisie (« Part du cumul de 0 à 1 000 000 F CFA : 15 % »), ou rien. */
function rangeSentence(rates: boolean, from: number, to: number | null, value: string): string | null {
  if (rates) {
    const bps = parsePercent(value);
    return bps === null ? null : t.rangeCommission(from, to, formatBps(bps));
  }
  const amount = parseAmount(value);
  return amount === null ? null : t.rangeFee(from, to, formatXof(amount));
}

/**
 * Éditeur des tranches (`tiered`) : bornes hautes incluses, croissantes et contiguës, dernière tranche
 * sans limite ; taux de la part (commission, calcul progressif) ou montant fixe (frais de dossier).
 * Chaque tranche se relit en clair sous ses champs.
 */
export function TiersEditor({
  object,
  tiers,
  errors,
  onChange,
}: {
  object: PricingObject;
  tiers: TierValues[];
  errors: Record<string, string>;
  onChange: (tiers: TierValues[]) => void;
}) {
  const rates = tiersAreRates(object);
  const update = (index: number, patch: Partial<TierValues>) =>
    onChange(tiers.map((tier, rank) => (rank === index ? { ...tier, ...patch } : tier)));
  // Borne basse de chaque tranche : borne haute de la précédente (0 pour la première).
  const bounds = tiers.map((tier, index) => (index === tiers.length - 1 ? null : parseAmount(tier.upTo)));
  const starts = bounds.map((_, index) => (index === 0 ? 0 : (bounds[index - 1] ?? 0)));
  return (
    <fieldset className="grid gap-4" aria-describedby="tranches-aide">
      <legend className="text-ink font-semibold">{t.title}</legend>
      <p id="tranches-aide" className="text-small text-ink-muted">
        {rates ? t.commissionLead : t.feeLead}
      </p>
      <ol className="grid gap-3">
        {tiers.map((tier, index) => {
          const last = index === tiers.length - 1;
          const sentence = rangeSentence(rates, starts[index] ?? 0, bounds[index] ?? null, tier.value);
          const valueField = `tiers[${index}].${rates ? 'rateBps' : 'fixedAmount'}`;
          return (
            <li key={index} className="rounded-card border-line bg-surface-muted grid gap-3 border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink font-semibold">{t.tier(index + 1)}</span>
                {tiers.length > 1 ? (
                  <Button variant="ghost" onClick={() => onChange(tiers.filter((_, rank) => rank !== index))}>
                    {t.remove(index + 1)}
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {last ? (
                  <p className="text-small text-ink-muted self-end">{t.last}</p>
                ) : (
                  <TextField
                    id={`tranche-${index}-borne`}
                    label={t.upTo}
                    inputMode="numeric"
                    value={tier.upTo}
                    error={errors[`tiers[${index}].upTo`]}
                    onChange={(event) => update(index, { upTo: event.target.value })}
                  />
                )}
                <TextField
                  id={`tranche-${index}-valeur`}
                  label={rates ? t.rate : t.amount}
                  inputMode={rates ? 'decimal' : 'numeric'}
                  value={tier.value}
                  error={errors[valueField]}
                  onChange={(event) => update(index, { value: event.target.value })}
                />
              </div>
              {sentence ? <p className="text-small text-ink">{sentence}</p> : null}
            </li>
          );
        })}
      </ol>
      {errors.tiers ? <FieldError id="tranches-erreur">{errors.tiers}</FieldError> : null}
      {tiers.length < MAX_TIERS ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => {
            // La nouvelle tranche devient la dernière (sans limite) ; l'ancienne dernière reçoit une borne.
            onChange([...tiers, { upTo: '', value: '' }]);
          }}
        >
          {t.add}
        </Button>
      ) : (
        <p className="text-small text-ink-muted">{t.max}</p>
      )}
    </fieldset>
  );
}
