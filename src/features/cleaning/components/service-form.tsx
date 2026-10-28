'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { forgetServiceNames, saveService, type ServiceInput } from '@/features/cleaning/api';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { errorText } from '@/features/cleaning/errors';
import type { ServiceDefinition } from '@/features/cleaning/schemas';
import { cleaningTexts, UNITS } from '@/features/cleaning/texts';

const t = catalogTexts.form;
const common = cleaningTexts.common;
const CODE = /^[a-z][a-z0-9_]{1,49}$/;

type Row = Record<string, string>;

/** Valeur d'une cellule, sans espaces autour. */
const cell = (row: Row, key: string) => (row[key] ?? '').trim();
type RowField = { key: string; label: string; numeric?: boolean };

/** Entier saisi ; `null` si le champ est vide ; `NaN` s'il n'est pas un entier. */
function amount(value: string | undefined): number | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Lignes répétables (options, coefficients de commune, liste de contrôle). */
function Rows({
  id,
  legend,
  fields,
  rows,
  setRows,
  addLabel,
}: {
  id: string;
  legend: string;
  fields: RowField[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  addLabel: string;
}) {
  return (
    <fieldset className="rounded-card border-line grid gap-3 border p-3 sm:p-4">
      <legend className="text-ink font-semibold">{legend}</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
          {fields.map((field) => (
            <TextField
              key={field.key}
              id={`${id}-${index}-${field.key}`}
              label={field.label}
              inputMode={field.numeric ? 'numeric' : undefined}
              value={row[field.key] ?? ''}
              onChange={(event) =>
                setRows(
                  rows.map((item, i) => (i === index ? { ...item, [field.key]: event.target.value } : item)),
                )
              }
            />
          ))}
          <Button
            variant="ghost"
            aria-label={`${t.remove} ${index + 1}`}
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
          >
            {t.remove}
          </Button>
        </div>
      ))}
      <Button variant="secondary" className="justify-self-start" onClick={() => setRows([...rows, {}])}>
        {addLabel}
      </Button>
    </fieldset>
  );
}

const str = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

/**
 * Création ou modification d'une prestation et de sa grille (UC-CL-11). Les prix sont des entiers de
 * FCFA ; un prix vide est envoyé `null` (« non fixé »). Aucune valeur n'est inventée par le front.
 */
export function ServiceForm({
  service,
  onSaved,
  onCancel,
}: {
  service: ServiceDefinition | null;
  onSaved: (service: ServiceDefinition) => void;
  onCancel: () => void;
}) {
  const pricing = service?.pricing;
  const [options, setOptions] = useState<Row[]>(
    pricing?.options.map((option) => ({
      code: option.code,
      label: option.label,
      price: str(option.price?.amount),
    })) ?? [],
  );
  const [coefficients, setCoefficients] = useState<Row[]>(
    pricing?.communeCoefficients.map((item) => ({
      commune: item.commune,
      coefficientBp: String(item.coefficientBp),
    })) ?? [],
  );
  const [checklist, setChecklist] = useState<Row[]>(
    pricing?.checklist.map((item) => ({ code: item.code, label: item.label })) ?? [],
  );
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? '');
    const code = service?.code ?? read('code').trim();
    if (!CODE.test(code)) {
      setCodeError(t.codeInvalid);
      document.getElementById('prestation-code')?.focus();
      return;
    }
    setCodeError(null);
    const name = read('name').trim();
    if (!name) return setError(`${t.name} : ${common.required}`);

    const team = ['unitsPerAgent', 'minAgents', 'maxAgents'].map((key) => amount(read(key)));
    const numbers = [
      amount(read('unitPrice')),
      amount(read('minimumPrice')),
      amount(read('defaultCoefficientBp')),
      ...team,
      ...options.map((row) => amount(row.price)),
      ...coefficients.map((row) => amount(row.coefficientBp)),
    ];
    if (numbers.some((value) => Number.isNaN(value))) return setError(common.invalidNumber);
    const incomplete =
      options.some((row) => !cell(row, 'code') || !cell(row, 'label')) ||
      coefficients.some((row) => !cell(row, 'commune') || amount(row.coefficientBp) === null) ||
      checklist.some((row) => !cell(row, 'code') || !cell(row, 'label')) ||
      (team.some((value) => value !== null) && team.some((value) => value === null));
    if (incomplete) return setError(common.required);

    const defaultCoefficientBp = amount(read('defaultCoefficientBp'));
    const [unitsPerAgent, minAgents, maxAgents] = team;
    const input: ServiceInput = {
      name,
      description: read('description').trim(),
      unit: read('unit'),
      active: data.get('active') === 'on',
      pricing: {
        unitPrice: amount(read('unitPrice')),
        minimumPrice: amount(read('minimumPrice')),
        options: options.map((row) => ({
          code: cell(row, 'code'),
          label: cell(row, 'label'),
          price: amount(row.price),
        })),
        communeCoefficients: coefficients.map((row) => ({
          commune: cell(row, 'commune'),
          coefficientBp: amount(row.coefficientBp) as number,
        })),
        checklist: checklist.map((row) => ({ code: cell(row, 'code'), label: cell(row, 'label') })),
        ...(defaultCoefficientBp !== null ? { defaultCoefficientBp } : {}),
        ...(typeof unitsPerAgent === 'number' &&
        typeof minAgents === 'number' &&
        typeof maxAgents === 'number'
          ? { teamSize: { unitsPerAgent, minAgents, maxAgents } }
          : {}),
      },
    };

    setPending(true);
    setError(null);
    try {
      const saved = await saveService(code, input);
      forgetServiceNames();
      onSaved(saved);
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="prestation-titre"
      className="bg-surface-muted rounded-card -mx-2 grid gap-5 p-3 sm:mx-0 sm:p-6"
    >
      <h3 id="prestation-titre" className="font-display text-h3 text-ink font-semibold">
        {service ? t.titleEdit(service.name) : t.titleNew}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {service ? null : (
          <TextField
            id="prestation-code"
            name="code"
            label={t.code}
            hint={t.codeHint}
            error={codeError}
            onChange={() => setCodeError(null)}
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        )}
        <TextField
          id="prestation-nom"
          name="name"
          label={t.name}
          defaultValue={service?.name}
          maxLength={100}
          required
        />
        <SelectField
          id="prestation-unite"
          name="unit"
          label={t.unit}
          defaultValue={service?.unit ?? 'square_meter'}
        >
          {Object.entries(UNITS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </SelectField>
        <label className="flex min-h-11 items-center gap-3 self-end">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service?.active ?? true}
            className="accent-brand size-5"
          />
          {t.active}
        </label>
      </div>
      <TextAreaField
        id="prestation-description"
        name="description"
        label={t.description}
        defaultValue={service?.description}
        maxLength={1000}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="prestation-prix"
          name="unitPrice"
          label={t.unitPrice}
          hint={t.priceHint}
          inputMode="numeric"
          defaultValue={str(pricing?.unitPrice?.amount)}
        />
        <TextField
          id="prestation-minimum"
          name="minimumPrice"
          label={t.minimumPrice}
          hint={t.priceHint}
          inputMode="numeric"
          defaultValue={str(pricing?.minimumPrice?.amount)}
        />
        <TextField
          id="prestation-coefficient"
          name="defaultCoefficientBp"
          label={t.defaultCoefficient}
          hint={t.coefficientHint}
          inputMode="numeric"
          defaultValue={str(pricing?.defaultCoefficientBp)}
        />
      </div>
      <fieldset className="rounded-card border-line grid gap-3 border p-3 sm:p-4">
        <legend className="text-ink font-semibold">{t.teamSize}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="prestation-unites-agent"
            name="unitsPerAgent"
            label={t.unitsPerAgent}
            inputMode="numeric"
            defaultValue={str(pricing?.teamSize.unitsPerAgent)}
          />
          <TextField
            id="prestation-agents-min"
            name="minAgents"
            label={t.minAgents}
            inputMode="numeric"
            defaultValue={str(pricing?.teamSize.minAgents)}
          />
          <TextField
            id="prestation-agents-max"
            name="maxAgents"
            label={t.maxAgents}
            inputMode="numeric"
            defaultValue={str(pricing?.teamSize.maxAgents)}
          />
        </div>
      </fieldset>
      <Rows
        id="option"
        legend={t.options}
        fields={[
          { key: 'code', label: t.optionCode },
          { key: 'label', label: t.optionLabel },
          { key: 'price', label: t.optionPrice, numeric: true },
        ]}
        rows={options}
        setRows={setOptions}
        addLabel={t.addOption}
      />
      <Rows
        id="commune"
        legend={t.coefficients}
        fields={[
          { key: 'commune', label: t.commune },
          { key: 'coefficientBp', label: t.coefficient, numeric: true },
        ]}
        rows={coefficients}
        setRows={setCoefficients}
        addLabel={t.addCoefficient}
      />
      <Rows
        id="controle"
        legend={t.checklist}
        fields={[
          { key: 'code', label: t.itemCode },
          { key: 'label', label: t.itemLabel },
        ]}
        rows={checklist}
        setRows={setChecklist}
        addLabel={t.addItem}
      />
      <FormMessage>{error}</FormMessage>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-busy={pending || undefined} disabled={pending}>
          {pending ? common.saving : t.confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
