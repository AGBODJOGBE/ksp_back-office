'use client';

import { type FormEvent, useCallback, useState } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  createTariffDraft,
  listTariffs,
  publishTariff,
  type TariffBody,
  updateTariffDraft,
  xof,
} from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { attempt } from '@/features/cleaning/errors';
import {
  coefficientInput,
  formatCoefficient,
  formatPercentBps,
  parseCoefficient,
  parseInteger,
  parsePercentBps,
  percentInput,
} from '@/features/cleaning/inputs';
import { cleaningPaths } from '@/features/cleaning/paths';
import type { Offer, Parameter, Tariff } from '@/features/cleaning/schemas';
import { cleaningTexts, nameOr } from '@/features/cleaning/texts';
import { FieldGroup, RowFrame } from './editors';
import type { Catalog } from './offers';
import {
  Amount,
  type FieldErrors,
  FormFooter,
  Note,
  Panel,
  ResourceView,
  useFormSubmit,
  useIdempotencyKey,
} from './parts';

const t = catalogTexts.tariffs;
const f = catalogTexts.frequencies;
const c = cleaningTexts.common;

const STATUS_TONES: Record<Tariff['status'], BadgeTone> = {
  draft: 'accent',
  published: 'success',
  archived: 'neutral',
};

/** Clés de fréquence du contrat (`weekly`, `monthly`, `every_N_weeks` de 2 à 12). */
const FREQUENCY_KEYS = [
  'weekly',
  'monthly',
  ...Array.from({ length: 11 }, (_, index) => `every_${index + 2}_weeks`),
];

export function frequencyLabel(key: string): string {
  if (key === 'weekly') return f.weekly;
  if (key === 'monthly') return f.monthly;
  const match = /^every_(\d+)_weeks$/.exec(key);
  return match ? f.everyWeeks(Number(match[1])) : key;
}

/** Paramètres demandés par le lieu de l'offre puis par l'offre elle-même : bases et suppléments possibles. */
function askedParameters(offer: Offer, catalog: Catalog): Parameter[] {
  const place = catalog.places.find((item) => item.id === offer.placeTypeId);
  const ids = [
    ...[...(place?.parameters ?? [])].sort((a, b) => a.order - b.order),
    ...[...offer.extraParameters].sort((a, b) => a.order - b.order),
  ].map((item) => item.parameterId);
  const byId = new Map(catalog.parameters.map((parameter) => [parameter.id, parameter]));
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

// --- Lecture d'une version ---------------------------------------------------------------------

function TariffSummary({ tariff, parameters }: { tariff: Tariff; parameters: Parameter[] }) {
  const label = (code: string) => parameters.find((parameter) => parameter.code === code)?.label ?? code;
  const unit = (code: string | null) => parameters.find((parameter) => parameter.code === code)?.unit ?? '';
  return (
    <div className="grid gap-3">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(9rem,max-content)_1fr]">
        {tariff.packDiscountBps === null ? (
          <>
            <dt className="text-small text-ink-muted font-medium">{t.baseShort}</dt>
            <dd>{tariff.baseParameterCode ? label(tariff.baseParameterCode) : '—'}</dd>
          </>
        ) : (
          <>
            <dt className="text-small text-ink-muted font-medium">{t.packDiscountShort}</dt>
            <dd>{formatPercentBps(tariff.packDiscountBps)}</dd>
          </>
        )}
        <dt className="text-small text-ink-muted font-medium">{t.minimumShort}</dt>
        <dd>
          <Amount value={tariff.minimum} />
        </dd>
      </dl>
      {tariff.brackets.length ? (
        <ul className="grid gap-1" aria-label={t.brackets}>
          {tariff.brackets.map((bracket, index) => (
            <li key={index} className="flex flex-wrap gap-x-3">
              <span className="tabular-nums">
                {t.bracketLine(bracket.from, bracket.to)} {unit(tariff.baseParameterCode)}
              </span>
              <span className="text-ink-muted">{t.modes[bracket.mode]}</span>
              <Amount value={bracket.amount} />
            </li>
          ))}
        </ul>
      ) : null}
      {tariff.supplements.length ? (
        <ul className="grid gap-1" aria-label={t.supplements}>
          {tariff.supplements.map((supplement, index) => (
            <li key={index} className="flex flex-wrap gap-x-3">
              <span>
                {label(supplement.parameterCode)}
                {supplement.choiceCode ? ` = ${supplement.choiceCode}` : ''}
              </span>
              <span className="text-ink-muted">
                {t.supplementModes[supplement.mode]}
                {supplement.mode === 'per_unit' && supplement.includedUnits
                  ? ` (${t.included_(supplement.includedUnits)})`
                  : ''}
              </span>
              {supplement.mode === 'coefficient' && supplement.coefficientBps !== null ? (
                <span className="tabular-nums">{formatCoefficient(supplement.coefficientBps)}</span>
              ) : (
                <Amount value={supplement.amount} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {tariff.frequencyCoefficients.length ? (
        <ul className="grid gap-1" aria-label={t.frequencies}>
          {tariff.frequencyCoefficients.map((entry) => (
            <li key={entry.key} className="flex flex-wrap gap-x-3">
              <span>{frequencyLabel(entry.key)}</span>
              <span className="tabular-nums">{formatCoefficient(entry.coefficientBps)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function VersionLine({ tariff }: { tariff: Tariff }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-ink font-semibold">v{tariff.version}</span>
      <Badge tone={STATUS_TONES[tariff.status]}>{t.statuses[tariff.status]}</Badge>
      <span className="text-small text-ink-muted">
        {tariff.publishedAt
          ? t.publishedBy(formatDateTime(tariff.publishedAt), nameOr(tariff.publishedByName, c.someone))
          : t.createdBy(formatDateTime(tariff.createdAt), nameOr(tariff.createdByName, c.someone))}
      </span>
    </span>
  );
}

// --- Saisie d'un brouillon ---------------------------------------------------------------------

interface BracketRow {
  from: string;
  to: string;
  mode: 'flat' | 'per_unit';
  amount: string;
}
interface SupplementRow {
  parameterCode: string;
  choiceCode: string;
  mode: 'fixed' | 'per_unit' | 'coefficient';
  amount: string;
  coefficient: string;
  included: string;
}
interface FrequencyRow {
  key: string;
  coefficient: string;
}
interface Draft {
  pricing: 'brackets' | 'discount';
  base: string;
  brackets: BracketRow[];
  supplements: SupplementRow[];
  minimum: string;
  frequencies: FrequencyRow[];
  discount: string;
}

const amountText = (money: { amount: number } | null | undefined) => (money ? String(money.amount) : '');

function draftOf(tariff: Tariff | null, parameters: Parameter[]): Draft {
  const area = parameters.find((parameter) => parameter.kind === 'number');
  if (!tariff) {
    return {
      pricing: 'brackets',
      base: area?.code ?? '',
      brackets: [],
      supplements: [],
      minimum: '',
      frequencies: [],
      discount: '',
    };
  }
  return {
    pricing: tariff.packDiscountBps === null ? 'brackets' : 'discount',
    base: tariff.baseParameterCode ?? area?.code ?? '',
    brackets: tariff.brackets.map((bracket) => ({
      from: String(bracket.from),
      to: String(bracket.to),
      mode: bracket.mode,
      amount: amountText(bracket.amount),
    })),
    supplements: tariff.supplements.map((supplement) => ({
      parameterCode: supplement.parameterCode,
      choiceCode: supplement.choiceCode ?? '',
      mode: supplement.mode,
      amount: amountText(supplement.amount),
      coefficient: supplement.coefficientBps === null ? '' : coefficientInput(supplement.coefficientBps),
      included: supplement.includedUnits ? String(supplement.includedUnits) : '',
    })),
    minimum: amountText(tariff.minimum),
    frequencies: tariff.frequencyCoefficients.map((entry) => ({
      key: entry.key,
      coefficient: coefficientInput(entry.coefficientBps),
    })),
    discount: tariff.packDiscountBps === null ? '' : percentInput(tariff.packDiscountBps),
  };
}

/** Une version dont les montants sont masqués (`cleaning.amounts.read` absent) ne peut pas être recopiée. */
const amountsHidden = (tariff: Tariff) =>
  tariff.minimum === undefined ||
  tariff.brackets.some((bracket) => bracket.amount === undefined) ||
  tariff.supplements.some((supplement) => supplement.amount === undefined);

const FIELDS = [
  'baseParameterCode',
  'brackets',
  'supplements',
  'minimum',
  'frequencyCoefficients',
  'packDiscountBps',
];
const MAX_AMOUNT = 100_000_000;
const MAX_VALUE = 1_000_000;

const amountOk = (raw: string) => {
  const value = parseInteger(raw);
  return value !== null && value <= MAX_AMOUNT;
};
const coefficientOk = (raw: string) => {
  const value = parseCoefficient(raw);
  return value !== null && value >= 1 && value <= 100_000;
};

/** Contrôles locaux de forme ; contiguïté, bornes et cohérence restent jugées par la gateway. */
function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  if (!amountOk(draft.minimum)) errors.minimum = c.invalidAmount;
  if (draft.pricing === 'discount') {
    const discount = parsePercentBps(draft.discount);
    if (discount === null || discount > 9000) errors.packDiscountBps = c.between(0, 90);
    return errors;
  }
  if (!draft.base) errors.baseParameterCode = c.required;
  draft.brackets.forEach((row, index) => {
    const at = `brackets[${index}]`;
    const from = parseInteger(row.from);
    const to = parseInteger(row.to);
    if (from === null || from > MAX_VALUE) errors[`${at}.from`] = c.between(0, MAX_VALUE);
    if (to === null || to > MAX_VALUE) errors[`${at}.to`] = c.between(0, MAX_VALUE);
    if (!amountOk(row.amount)) errors[`${at}.amount`] = c.invalidAmount;
  });
  draft.supplements.forEach((row, index) => {
    const at = `supplements[${index}]`;
    if (!row.parameterCode) errors[`${at}.parameterCode`] = c.required;
    if (row.mode === 'coefficient') {
      if (!coefficientOk(row.coefficient)) errors[`${at}.coefficientBps`] = c.invalidCoefficient;
    } else if (!amountOk(row.amount)) errors[`${at}.amount`] = c.invalidAmount;
    if (row.mode === 'per_unit' && row.included.trim() && parseInteger(row.included) === null) {
      errors[`${at}.includedUnits`] = c.invalidInteger;
    }
  });
  draft.frequencies.forEach((row, index) => {
    const at = `frequencyCoefficients[${index}]`;
    if (!row.key) errors[`${at}.key`] = c.required;
    if (!coefficientOk(row.coefficient)) errors[`${at}.coefficientBps`] = c.invalidCoefficient;
  });
  return errors;
}

function bodyOf(draft: Draft, parameters: Parameter[]): TariffBody {
  const minimum = xof(parseInteger(draft.minimum) ?? 0);
  if (draft.pricing === 'discount') {
    return {
      brackets: [],
      supplements: [],
      minimum,
      frequencyCoefficients: [],
      packDiscountBps: parsePercentBps(draft.discount) ?? 0,
    };
  }
  const kindOf = (code: string) => parameters.find((parameter) => parameter.code === code)?.kind;
  return {
    baseParameterCode: draft.base,
    brackets: draft.brackets.map((row) => ({
      from: parseInteger(row.from) ?? 0,
      to: parseInteger(row.to) ?? 0,
      mode: row.mode,
      amount: xof(parseInteger(row.amount) ?? 0),
    })),
    supplements: draft.supplements.map((row) => ({
      parameterCode: row.parameterCode,
      choiceCode: kindOf(row.parameterCode) === 'choice' && row.choiceCode ? row.choiceCode : undefined,
      mode: row.mode,
      amount: row.mode === 'coefficient' ? undefined : xof(parseInteger(row.amount) ?? 0),
      coefficientBps: row.mode === 'coefficient' ? (parseCoefficient(row.coefficient) ?? 0) : undefined,
      includedUnits: row.mode === 'per_unit' ? (parseInteger(row.included) ?? 0) : undefined,
    })),
    minimum,
    frequencyCoefficients: draft.frequencies.map((row) => ({
      key: row.key,
      coefficientBps: parseCoefficient(row.coefficient) ?? 0,
    })),
  };
}

function BracketsEditor({
  draft,
  errors,
  numbers,
  change,
}: {
  draft: Draft;
  errors: FieldErrors;
  numbers: Parameter[];
  change: (patch: Partial<Draft>) => void;
}) {
  const rows = draft.brackets;
  const update = (index: number, patch: Partial<BracketRow>) =>
    change({ brackets: rows.map((row, at) => (at === index ? { ...row, ...patch } : row)) });
  function add() {
    // Commodité de saisie : la tranche suivante commence juste après la précédente (ADR-056).
    const previous = rows.at(-1);
    const end = previous ? parseInteger(previous.to) : null;
    const base = numbers.find((parameter) => parameter.code === draft.base);
    const from = previous ? (end === null ? '' : String(end + 1)) : String(base?.min ?? 0);
    change({ brackets: [...rows, { from, to: '', mode: previous?.mode ?? 'per_unit', amount: '' }] });
  }
  return (
    <FieldGroup id="tarif-tranches" legend={t.brackets} hint={t.bracketsHint} error={errors.brackets}>
      {rows.map((row, index) => {
        const at = `brackets[${index}]`;
        return (
          <RowFrame
            key={index}
            id={`tarif-tranche-${index}`}
            title={t.bracket(index + 1)}
            error={errors[at]}
            onRemove={() => change({ brackets: rows.filter((_, position) => position !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField
                id={`tarif-tranche-${index}-de`}
                label={t.from}
                inputMode="numeric"
                value={row.from}
                error={errors[`${at}.from`]}
                onChange={(event) => update(index, { from: event.target.value })}
              />
              <TextField
                id={`tarif-tranche-${index}-a`}
                label={t.to}
                inputMode="numeric"
                value={row.to}
                error={errors[`${at}.to`]}
                onChange={(event) => update(index, { to: event.target.value })}
              />
              <SelectField
                id={`tarif-tranche-${index}-mode`}
                label={t.mode}
                value={row.mode}
                error={errors[`${at}.mode`]}
                onChange={(event) => update(index, { mode: event.target.value as BracketRow['mode'] })}
              >
                <option value="per_unit">{t.modes.per_unit}</option>
                <option value="flat">{t.modes.flat}</option>
              </SelectField>
              <TextField
                id={`tarif-tranche-${index}-montant`}
                label={t.amount}
                inputMode="numeric"
                value={row.amount}
                error={errors[`${at}.amount`]}
                onChange={(event) => update(index, { amount: event.target.value })}
              />
            </div>
          </RowFrame>
        );
      })}
      {rows.length >= 30 ? null : (
        <Button variant="secondary" className="justify-self-start" onClick={add}>
          {t.addBracket}
        </Button>
      )}
    </FieldGroup>
  );
}

function SupplementsEditor({
  draft,
  errors,
  parameters,
  change,
}: {
  draft: Draft;
  errors: FieldErrors;
  parameters: Parameter[];
  change: (patch: Partial<Draft>) => void;
}) {
  const rows = draft.supplements;
  const update = (index: number, patch: Partial<SupplementRow>) =>
    change({ supplements: rows.map((row, at) => (at === index ? { ...row, ...patch } : row)) });
  const candidates = parameters.filter((parameter) => parameter.code !== draft.base);
  return (
    <FieldGroup
      id="tarif-supplements"
      legend={t.supplements}
      hint={t.supplementsHint}
      error={errors.supplements}
    >
      {rows.map((row, index) => {
        const at = `supplements[${index}]`;
        const parameter = parameters.find((item) => item.code === row.parameterCode);
        return (
          <RowFrame
            key={index}
            id={`tarif-supplement-${index}`}
            title={t.supplement(index + 1)}
            error={errors[at]}
            onRemove={() => change({ supplements: rows.filter((_, position) => position !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id={`tarif-supplement-${index}-parametre`}
                label={t.parameter}
                value={row.parameterCode}
                error={errors[`${at}.parameterCode`]}
                onChange={(event) => update(index, { parameterCode: event.target.value, choiceCode: '' })}
              >
                <option value="">{t.chooseParameter}</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              {parameter?.kind === 'choice' ? (
                <SelectField
                  id={`tarif-supplement-${index}-valeur`}
                  label={t.choice}
                  value={row.choiceCode}
                  error={errors[`${at}.choiceCode`]}
                  onChange={(event) => update(index, { choiceCode: event.target.value })}
                >
                  <option value="">{t.chooseChoice}</option>
                  {parameter.choices.map((choice) => (
                    <option key={choice.code} value={choice.code}>
                      {choice.label}
                    </option>
                  ))}
                </SelectField>
              ) : null}
              <SelectField
                id={`tarif-supplement-${index}-effet`}
                label={t.supplementMode}
                value={row.mode}
                error={errors[`${at}.mode`]}
                onChange={(event) => update(index, { mode: event.target.value as SupplementRow['mode'] })}
              >
                <option value="fixed">{t.supplementModes.fixed}</option>
                {parameter?.kind === 'number' ? (
                  <option value="per_unit">{t.supplementModes.per_unit}</option>
                ) : null}
                <option value="coefficient">{t.supplementModes.coefficient}</option>
              </SelectField>
              {row.mode === 'coefficient' ? (
                <TextField
                  id={`tarif-supplement-${index}-coefficient`}
                  label={t.coefficient}
                  hint={t.coefficientHint}
                  inputMode="decimal"
                  value={row.coefficient}
                  error={errors[`${at}.coefficientBps`]}
                  onChange={(event) => update(index, { coefficient: event.target.value })}
                />
              ) : (
                <TextField
                  id={`tarif-supplement-${index}-montant`}
                  label={t.amount}
                  inputMode="numeric"
                  value={row.amount}
                  error={errors[`${at}.amount`]}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
              )}
              {row.mode === 'per_unit' ? (
                <TextField
                  id={`tarif-supplement-${index}-compris`}
                  label={t.included}
                  hint={t.includedHint}
                  inputMode="numeric"
                  value={row.included}
                  error={errors[`${at}.includedUnits`]}
                  onChange={(event) => update(index, { included: event.target.value })}
                />
              ) : null}
            </div>
          </RowFrame>
        );
      })}
      {rows.length >= 50 ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() =>
            change({
              supplements: [
                ...rows,
                {
                  parameterCode: '',
                  choiceCode: '',
                  mode: 'fixed',
                  amount: '',
                  coefficient: '',
                  included: '',
                },
              ],
            })
          }
        >
          {t.addSupplement}
        </Button>
      )}
    </FieldGroup>
  );
}

function FrequenciesEditor({
  draft,
  errors,
  change,
}: {
  draft: Draft;
  errors: FieldErrors;
  change: (patch: Partial<Draft>) => void;
}) {
  const rows = draft.frequencies;
  const update = (index: number, patch: Partial<FrequencyRow>) =>
    change({ frequencies: rows.map((row, at) => (at === index ? { ...row, ...patch } : row)) });
  return (
    <FieldGroup
      id="tarif-frequences"
      legend={t.frequencies}
      hint={t.frequenciesHint}
      error={errors.frequencyCoefficients}
    >
      {rows.map((row, index) => {
        const at = `frequencyCoefficients[${index}]`;
        return (
          <RowFrame
            key={index}
            id={`tarif-frequence-${index}`}
            title={t.frequencyLine(index + 1)}
            error={errors[at]}
            onRemove={() => change({ frequencies: rows.filter((_, position) => position !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id={`tarif-frequence-${index}-cle`}
                label={t.frequency}
                value={row.key}
                error={errors[`${at}.key`]}
                onChange={(event) => update(index, { key: event.target.value })}
              >
                <option value="">—</option>
                {FREQUENCY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {frequencyLabel(key)}
                  </option>
                ))}
              </SelectField>
              <TextField
                id={`tarif-frequence-${index}-coefficient`}
                label={t.coefficient}
                hint={t.coefficientHint}
                inputMode="decimal"
                value={row.coefficient}
                error={errors[`${at}.coefficientBps`]}
                onChange={(event) => update(index, { coefficient: event.target.value })}
              />
            </div>
          </RowFrame>
        );
      })}
      {rows.length >= 20 ? null : (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => change({ frequencies: [...rows, { key: '', coefficient: '' }] })}
        >
          {t.addFrequency}
        </Button>
      )}
    </FieldGroup>
  );
}

/**
 * Brouillon de tarif : la première sauvegarde le crée (`POST …/tariffs`, clé d'idempotence), les
 * suivantes le remplacent (`PUT …/tariffs/{version}`). Aucun prix n'est calculé ici.
 */
function DraftEditor({
  offer,
  draftTariff,
  from,
  parameters,
  isPack,
  onSaved,
}: {
  offer: Offer;
  draftTariff: Tariff | null;
  from: Tariff | null;
  parameters: Parameter[];
  isPack: boolean;
  onSaved: (tariff: Tariff) => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftOf(draftTariff ?? from, parameters));
  const [dirty, setDirty] = useState(!draftTariff);
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<Draft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setDirty(true);
    form.clearSuccess();
  };
  const numbers = parameters.filter((parameter) => parameter.kind === 'number');

  function submit(event: FormEvent) {
    void form.submit(event, validate(draft), async () => {
      const body = bodyOf(draft, parameters);
      try {
        const saved = draftTariff
          ? await updateTariffDraft(offer.id, draftTariff.version, body)
          : await createTariffDraft(offer.id, body, idempotency.key());
        idempotency.settle();
        setDirty(false);
        onSaved(saved);
        return t.draftSaved;
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      {isPack ? (
        <FieldGroup id="tarif-mode" legend={t.pricing}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['brackets', t.byBrackets, t.byBracketsHint],
                ['discount', t.byDiscount, t.byDiscountHint],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="rounded-control border-line-control has-[:checked]:border-action has-[:checked]:bg-action-soft flex min-h-11 items-start gap-3 border p-3"
              >
                <input
                  type="radio"
                  name="tarif-mode"
                  value={value}
                  checked={draft.pricing === value}
                  onChange={() => change({ pricing: value })}
                  className="accent-action mt-1 size-5 shrink-0"
                />
                <span className="grid gap-0.5">
                  <span className="text-ink font-semibold">{label}</span>
                  <span className="text-small text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </FieldGroup>
      ) : null}
      {draft.pricing === 'discount' ? (
        <TextField
          id="tarif-remise"
          label={t.discount}
          hint={t.discountHint}
          inputMode="decimal"
          value={draft.discount}
          error={form.errors.packDiscountBps}
          onChange={(event) => change({ discount: event.target.value })}
          className="max-w-xs"
        />
      ) : (
        <>
          {numbers.length ? null : <FormMessage tone="info">{t.noParameters}</FormMessage>}
          <SelectField
            id="tarif-base"
            label={t.base}
            hint={t.baseHint}
            value={draft.base}
            error={form.errors.baseParameterCode}
            onChange={(event) => change({ base: event.target.value })}
            className="max-w-md"
          >
            <option value="">{t.chooseBase}</option>
            {numbers.map((parameter) => (
              <option key={parameter.id} value={parameter.code}>
                {parameter.label}
                {parameter.unit ? ` (${parameter.unit})` : ''}
              </option>
            ))}
          </SelectField>
          <BracketsEditor draft={draft} errors={form.errors} numbers={numbers} change={change} />
          <SupplementsEditor draft={draft} errors={form.errors} parameters={parameters} change={change} />
          <FrequenciesEditor draft={draft} errors={form.errors} change={change} />
        </>
      )}
      <TextField
        id="tarif-minimum"
        label={t.minimum}
        inputMode="numeric"
        value={draft.minimum}
        error={form.errors.minimum}
        onChange={(event) => change({ minimum: event.target.value })}
        className="max-w-xs"
      />
      <FormFooter
        pending={form.pending}
        message={form.message}
        success={form.success}
        label={t.saveDraft}
        disabled={!dirty}
      />
      {dirty && draftTariff ? <Note>{t.unsaved}</Note> : null}
    </form>
  );
}

function PublishDraft({
  offer,
  draftTariff,
  onPublished,
}: {
  offer: Offer;
  draftTariff: Tariff;
  onPublished: (tariff: Tariff) => void;
}) {
  const idempotency = useIdempotencyKey();
  return (
    <ConfirmAction
      label={t.publish}
      variant="action"
      title={t.publishTitle(draftTariff.version)}
      description={t.publishText}
      confirmLabel={t.publishConfirm}
      labels={{ cancel: c.cancel, pending: c.sending }}
      onConfirm={() =>
        attempt(async () => {
          try {
            const published = await publishTariff(offer.id, draftTariff.version, idempotency.key());
            idempotency.settle();
            onPublished(published);
          } catch (error) {
            idempotency.settle(error);
            throw error;
          }
        })
      }
    />
  );
}

/**
 * Tarif d'une offre (R-CA-07, R-CA-08) : version en vigueur, brouillon (préparer, modifier, essayer au
 * simulateur, publier avec confirmation) et versions précédentes.
 */
export function TariffsPanel({
  offer,
  catalog,
  canManage,
  onOfferChanged,
}: {
  offer: Offer;
  catalog: Catalog;
  canManage: boolean;
  onOfferChanged: () => void;
}) {
  const tariffs = useResource(useCallback(() => listTariffs(offer.id)(), [offer.id]));
  const [editing, setEditing] = useState(false);
  const [published, setPublished] = useState<number | null>(null);
  const parameters = askedParameters(offer, catalog);
  const isPack = catalog.types.find((type) => type.id === offer.cleaningTypeId)?.isPack ?? false;

  return (
    <Panel title={t.title} id="offre-tarif">
      <p className="text-ink-muted max-w-reading">{t.lead}</p>
      <FormMessage tone="success">{published === null ? null : t.published(published)}</FormMessage>
      <ResourceView resource={tariffs} lines={4}>
        {(page) => {
          const current = page.data.find((tariff) => tariff.status === 'published') ?? null;
          const draftTariff = page.data.find((tariff) => tariff.status === 'draft') ?? null;
          const older = page.data.filter((tariff) => tariff.status === 'archived');
          const replace = (saved: Tariff) =>
            tariffs.set({
              ...page,
              data: [saved, ...page.data.filter((tariff) => tariff.id !== saved.id)].sort(
                (a, b) => b.version - a.version,
              ),
            });
          const hidden =
            (draftTariff ?? current) !== null && amountsHidden((draftTariff ?? current) as Tariff);
          return (
            <div className="grid gap-6">
              <section aria-labelledby="tarif-en-vigueur" className="grid gap-3">
                <h3 id="tarif-en-vigueur" className="text-ink font-semibold">
                  {current ? t.current(current.version) : t.none}
                </h3>
                {current ? (
                  <>
                    <VersionLine tariff={current} />
                    <TariffSummary tariff={current} parameters={parameters} />
                  </>
                ) : null}
              </section>

              {draftTariff || editing ? (
                <section aria-labelledby="tarif-brouillon" className="border-line grid gap-4 border-t pt-5">
                  <h3 id="tarif-brouillon" className="text-ink font-semibold">
                    {draftTariff ? t.draftTitle(draftTariff.version) : t.prepare}
                  </h3>
                  {draftTariff ? <VersionLine tariff={draftTariff} /> : <Note>{t.prepareFromCurrent}</Note>}
                  <p className="text-small text-ink-muted">{t.draftLead}</p>
                  {canManage && !hidden ? (
                    <DraftEditor
                      key={offer.id}
                      offer={offer}
                      draftTariff={draftTariff}
                      from={current}
                      parameters={parameters}
                      isPack={isPack}
                      onSaved={(saved) => {
                        replace(saved);
                        setPublished(null);
                        onOfferChanged();
                      }}
                    />
                  ) : draftTariff ? (
                    <TariffSummary tariff={draftTariff} parameters={parameters} />
                  ) : null}
                  {draftTariff ? (
                    <div className="flex flex-wrap gap-3">
                      <ButtonLink
                        variant="secondary"
                        href={cleaningPaths.catalog.simulate(
                          offer.placeTypeId,
                          [offer.cleaningTypeId],
                          [draftTariff.id],
                        )}
                      >
                        {t.tryDraft}
                      </ButtonLink>
                      {canManage ? (
                        <PublishDraft
                          offer={offer}
                          draftTariff={draftTariff}
                          onPublished={(tariff) => {
                            setEditing(false);
                            setPublished(tariff.version);
                            tariffs.refresh();
                            onOfferChanged();
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : canManage ? (
                <Button variant="action" className="justify-self-start" onClick={() => setEditing(true)}>
                  {t.prepare}
                </Button>
              ) : (
                <Note>{t.readOnly}</Note>
              )}

              {older.length ? (
                <section aria-labelledby="tarif-versions" className="border-line grid gap-3 border-t pt-5">
                  <h3 id="tarif-versions" className="text-ink font-semibold">
                    {t.versions}
                  </h3>
                  <ul className="grid gap-3">
                    {older.map((tariff) => (
                      <li key={tariff.id}>
                        <details className="group">
                          <summary className="flex min-h-11 cursor-pointer items-center">
                            <VersionLine tariff={tariff} />
                          </summary>
                          <div className="mt-2 pl-4">
                            <TariffSummary tariff={tariff} parameters={parameters} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          );
        }}
      </ResourceView>
    </Panel>
  );
}
