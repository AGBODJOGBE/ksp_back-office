'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatXof } from '@/lib/format';
import { simulate, type SimulationInput } from '@/features/recovery/pricing-api';
import { simulatorTexts as t } from '@/features/recovery/pricing-editor-texts';
import { parseAmount } from '@/features/recovery/pricing-form';
import {
  type Offer,
  OFFERS,
  PRICING_OBJECTS,
  type PricingObject,
  type Rule,
  SIMULATION_STAGES,
  type Simulation,
} from '@/features/recovery/pricing-schemas';
import { objectLabel, offerLabel, pricingTexts } from '@/features/recovery/pricing-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import { formatBps, stageLabel } from '@/features/recovery/texts';
import { FormFooter, Panel, useFormSubmit } from './parts';

type Line = Simulation['lines'][number];

const columns: TableColumn<Line & { key: string }>[] = [
  { key: 'label', header: t.columns.label, primary: true, cell: (row) => row.label },
  {
    key: 'base',
    header: t.columns.base,
    cell: (row) => <span className="tabular-nums">{formatXof(row.base)}</span>,
  },
  {
    key: 'rate',
    header: t.columns.rate,
    cell: (row) =>
      row.rateBps === null ? '—' : <span className="tabular-nums">{formatBps(row.rateBps)}</span>,
  },
  {
    key: 'amount',
    header: t.columns.amount,
    cell: (row) => <span className="tabular-nums">{formatXof(row.amount)}</span>,
  },
];

function SimulationResult({ result, linkRule }: { result: Simulation; linkRule: boolean }) {
  return (
    <Panel title={t.resultTitle} id="simulation-resultat">
      <p className="font-display text-h3 text-ink font-semibold tabular-nums">
        <span className="text-small text-ink-muted block font-sans font-medium">{t.amount}</span>
        {formatXof(result.amount)}
      </p>
      {result.boundApplied ? (
        <p className="text-ink font-semibold">{t.boundApplied[result.boundApplied]}</p>
      ) : null}
      <ResponsiveTable
        caption={t.caption}
        columns={columns}
        rows={result.lines.map((line, index) => ({ ...line, key: String(index) }))}
        rowKey={(row) => row.key}
      />
      <p className="text-small text-ink-muted">
        {t.rule(result.ruleVersion)}
        {linkRule ? (
          <>
            {' · '}
            <Link
              href={recoveryPaths.rule(result.ruleId)}
              className="text-accent-ink font-semibold underline-offset-4 hover:underline"
            >
              {t.openRule}
            </Link>
          </>
        ) : null}
      </p>
    </Panel>
  );
}

/**
 * Simulateur (`POST /recovery/pricing-simulations`, R-TA-01) : une règle désignée (brouillon compris,
 * sur sa fiche) ou la règle publiée applicable à une cible (écran du simulateur).
 */
export function PricingSimulator({ rule }: { rule?: Rule }) {
  const [object, setObject] = useState<PricingObject>(rule?.object ?? 'recovery_commission');
  const [offer, setOffer] = useState<Exclude<Offer, 'any'>>('b2b');
  const [base, setBase] = useState('');
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<Simulation | null>(null);
  const form = useFormSubmit(['baseAmount', 'target', 'stage']);

  function submit(event: FormEvent) {
    const amount = parseAmount(base);
    const errors: Record<string, string> = amount === null || amount < 1 ? { baseAmount: t.invalidBase } : {};
    void form.submit(event, errors, async () => {
      setResult(null);
      const input: SimulationInput = rule
        ? {
            ruleId: rule.id,
            object: rule.object,
            target: rule.target,
            baseAmount: { amount: amount ?? 0, currency: 'XOF' },
          }
        : { object, target: { offer }, baseAmount: { amount: amount ?? 0, currency: 'XOF' } };
      setResult(await simulate(stage ? { ...input, stage } : input));
    });
  }

  const shownObject = rule?.object ?? object;
  return (
    <div className="grid gap-6">
      <form noValidate onSubmit={submit} className="grid gap-4">
        {rule ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="simulation-objet"
              label={pricingTexts.list.object}
              value={object}
              onChange={(event) => setObject(event.target.value as PricingObject)}
            >
              {PRICING_OBJECTS.map((value) => (
                <option key={value} value={value}>
                  {objectLabel(value)}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="simulation-offre"
              label={pricingTexts.list.offer}
              value={offer}
              onChange={(event) => setOffer(event.target.value as Exclude<Offer, 'any'>)}
            >
              {OFFERS.filter((value) => value !== 'any').map((value) => (
                <option key={value} value={value}>
                  {offerLabel(value)}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="simulation-base"
            label={t.baseAmount}
            hint={t.baseHint[shownObject]}
            inputMode="numeric"
            value={base}
            error={form.errors.baseAmount}
            onChange={(event) => setBase(event.target.value)}
          />
          {shownObject === 'recovery_commission' ? (
            <SelectField
              id="simulation-etape"
              label={t.stage}
              hint={t.stageHint}
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value="">{t.defaultStage}</option>
              {SIMULATION_STAGES.map((value) => (
                <option key={value} value={value}>
                  {stageLabel(value)}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>
        <FormFooter pending={form.pending} message={form.message} label={t.run} pendingLabel={t.running} />
      </form>
      <div aria-live="polite">{result ? <SimulationResult result={result} linkRule={!rule} /> : null}</div>
    </div>
  );
}
