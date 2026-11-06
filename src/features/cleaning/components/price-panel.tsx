'use client';

import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { formatXof } from '@/lib/format';
import { errorText } from '@/features/cleaning/errors';
import type { FormModel } from '@/features/cleaning/form-model';
import { measureTexts } from '@/features/cleaning/measure-texts';
import { requestTexts } from '@/features/cleaning/request-detail-texts';
import type { Calculation } from '@/features/cleaning/schemas';
import type { LivePrice } from './use-live-price';

const t = measureTexts.price;
const c = requestTexts.calc;
const factor = new Intl.NumberFormat('fr-BJ', { maximumFractionDigits: 4 });
const money = (value: { amount: number } | null) => (value ? formatXof(value.amount) : null);

/** Détail d'un calcul du serveur (lignes, coefficients, minimum, prix), affiché tel quel. */
export function CalculationDetails({ calculation }: { calculation: Calculation }) {
  return (
    <div className="grid gap-4">
      {calculation.pricingVersion !== null ? (
        <p className="text-small text-ink-muted">{c.version(calculation.pricingVersion)}</p>
      ) : null}
      {calculation.lines.length ? (
        <ResponsiveTable
          caption={c.lines}
          rows={calculation.lines.map((line, index) => ({ ...line, key: String(index) }))}
          rowKey={(line) => line.key}
          columns={[
            { key: 'label', header: c.columns.label, primary: true, cell: (line) => line.label },
            {
              key: 'quantity',
              header: c.columns.quantity,
              className: 'tabular-nums',
              cell: (line) => (line.unitLabel ? `${line.quantity} ${line.unitLabel}` : line.quantity),
            },
            {
              key: 'unitPrice',
              header: c.columns.unitPrice,
              className: 'tabular-nums',
              cell: (line) => formatXof(line.unitPrice),
            },
            {
              key: 'amount',
              header: c.columns.amount,
              className: 'tabular-nums',
              cell: (line) => formatXof(line.amount),
            },
          ]}
        />
      ) : null}
      <DescriptionList
        items={[
          { term: c.base, value: money(calculation.baseAmount) },
          {
            term: c.coefficients,
            value: calculation.coefficients.length ? (
              <ul className="grid gap-1">
                {calculation.coefficients.map((item, index) => (
                  <li key={index}>{c.coefficient(item.label, factor.format(item.coefficientBp / 10_000))}</li>
                ))}
              </ul>
            ) : null,
          },
          { term: c.subtotal, value: money(calculation.subtotal) },
          {
            term: c.minimum,
            value: calculation.minimumPrice
              ? `${formatXof(calculation.minimumPrice)}${calculation.minimumApplied ? ` (${c.minimumApplied})` : ''}`
              : null,
          },
          {
            term: c.computed,
            value: calculation.computedPrice ? <strong>{formatXof(calculation.computedPrice)}</strong> : null,
          },
          {
            term: c.estimate,
            value: calculation.estimate
              ? `${formatXof(calculation.estimate.low)} – ${formatXof(calculation.estimate.high)}`
              : null,
          },
          { term: c.recommendedTeamSize, value: calculation.recommendedTeamSize },
        ]}
      />
    </div>
  );
}

/** Libellés des prix manquants (`missingPrices`) d'après le formulaire : une liste de contrôle lisible. */
export function missingPriceLabels(calculation: Calculation, model: FormModel | null): string[] {
  return calculation.missingPrices.map((missing) => {
    const option = missing.optionCode ? model?.options.find((o) => o.code === missing.optionCode) : undefined;
    const fields = missing.optionCode ? (option?.fields ?? []) : (model?.fields ?? []);
    if (!missing.fieldCode) return t.missing.option(option?.label ?? missing.optionCode ?? '');
    const field = fields.find((f) => f.code === missing.fieldCode);
    const label = field?.label ?? missing.fieldCode;
    const named = option ? `${option.label} — ${label}` : label;
    if (missing.choiceCode) {
      const choice =
        field?.choices.find((item) => item.code === missing.choiceCode)?.label ?? missing.choiceCode;
      return t.missing.choice(named, choice);
    }
    return field?.type === 'boolean' ? t.missing.boolean(named) : t.missing.field(named);
  });
}

/**
 * Prix recalculé par la gateway, annoncé aux lecteurs d'écran (`aria-live`) à chaque nouveau calcul : prix,
 * fourchette, équipe conseillée, prix manquants, détail replié. `announced` : prix annoncé au client, à côté.
 */
export function PricePanel({
  price,
  model,
  announced,
  covered = true,
  title = t.title,
  showError = true,
}: {
  price: LivePrice<Calculation>;
  model: FormModel | null;
  announced?: Calculation | null;
  covered?: boolean;
  title?: string;
  /** `false` : l'erreur est déjà affichée sous le champ visé. */
  showError?: boolean;
}) {
  const calculation = price.status === 'ready' ? price.data : price.last;
  const announcedPrice = announced?.priced ? announced.computedPrice : null;
  return (
    <section
      aria-label={title}
      className="rounded-card border-line bg-surface-muted grid content-start gap-3 border p-4"
    >
      <p className="text-ink font-semibold">{title}</p>
      {announced !== undefined ? (
        <p className="text-small text-ink-muted tabular-nums">
          {t.announced} : {announcedPrice ? formatXof(announcedPrice) : c.notPriced}
        </p>
      ) : null}
      <div aria-live="polite" aria-atomic="true" className="grid gap-1">
        {price.status === 'loading' ? <p className="text-small text-ink-muted">{t.pending}</p> : null}
        {price.status === 'idle' && !calculation ? (
          <p className="text-small text-ink-muted">{t.waiting}</p>
        ) : null}
        {calculation ? (
          calculation.priced && calculation.computedPrice ? (
            <>
              <p className="text-small text-ink-muted">{t.recalculated}</p>
              <p className="font-display text-h3 text-ink font-semibold tabular-nums">
                {formatXof(calculation.computedPrice)}
              </p>
              {calculation.estimate ? (
                <p className="text-small text-ink-muted tabular-nums">
                  {t.range(formatXof(calculation.estimate.low), formatXof(calculation.estimate.high))}
                </p>
              ) : null}
              <p className="text-small text-ink">{t.team(calculation.recommendedTeamSize)}</p>
            </>
          ) : (
            <p className="text-ink font-semibold">{t.notPriced}</p>
          )
        ) : null}
      </div>
      {!covered ? <p className="text-small text-warning">{t.uncovered}</p> : null}
      {price.status === 'error' && showError ? <FormMessage>{errorText(price.error)}</FormMessage> : null}
      {calculation && calculation.missingPrices.length ? (
        <div className="grid gap-1">
          <p className="text-small text-ink font-semibold">{t.missingTitle}</p>
          <ul className="text-small grid list-disc gap-1 pl-5">
            {missingPriceLabels(calculation, model).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {calculation ? (
        <details className="group">
          <summary className="text-small text-accent-ink min-h-11 cursor-pointer content-center font-semibold underline">
            {t.details}
          </summary>
          <div className="pt-3">
            <CalculationDetails calculation={calculation} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
