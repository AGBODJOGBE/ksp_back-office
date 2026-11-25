'use client';

import { type FormEvent, useState } from 'react';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { createRule, updateRule } from '@/features/recovery/pricing-api';
import { editorTexts } from '@/features/recovery/pricing-editor-texts';
import { ruleInput, type RuleValues, validateRule } from '@/features/recovery/pricing-form';
import { OFFERS, type Offer, type Rule } from '@/features/recovery/pricing-schemas';
import { offerLabel } from '@/features/recovery/pricing-texts';
import { FormFooter, useFormSubmit, useIdempotencyKey } from './parts';
import { RuleCalculation } from './rule-fields';

const e = editorTexts;

/** Champs que le service peut nommer dans un refus (`details.field`, chemins du contrat). */
const FIELDS = [
  'label',
  'fixedAmount',
  'rateBps',
  'tiers',
  'stageRates',
  'minimum',
  'maximum',
  'target',
  'validFrom',
  'validUntil',
];

function RuleTarget({
  values,
  errors,
  onChange,
}: {
  values: RuleValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<RuleValues>) => void;
}) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-ink font-semibold">{e.target}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="regle-offre"
          label={e.offer}
          value={values.offer}
          onChange={(event) => onChange({ offer: event.target.value as Offer })}
        >
          {OFFERS.map((offer) => (
            <option key={offer} value={offer}>
              {offerLabel(offer)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="regle-commune"
          label={e.communeKey}
          hint={e.communeHint}
          value={values.communeKey}
          error={errors['target.communeKey']}
          onChange={(event) => onChange({ communeKey: event.target.value })}
        />
      </div>
      <div className="flex items-start gap-3">
        <input
          id="regle-negociee"
          type="checkbox"
          checked={values.negotiated}
          aria-describedby="regle-negociee-aide"
          className="accent-action mt-1 size-5 shrink-0"
          onChange={(event) => onChange({ negotiated: event.target.checked })}
        />
        <div>
          <label htmlFor="regle-negociee" className="text-ink font-semibold">
            {e.negotiated}
          </label>
          <p id="regle-negociee-aide" className="text-small text-ink-muted">
            {e.negotiatedHint}
          </p>
        </div>
      </div>
      {values.negotiated ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="regle-creancier-type"
            label={e.creditorType}
            value={values.creditorType}
            onChange={(event) => onChange({ creditorType: event.target.value as RuleValues['creditorType'] })}
          >
            <option value="organization">{e.creditorTypes.organization}</option>
            <option value="user">{e.creditorTypes.user}</option>
          </SelectField>
          <TextField
            id="regle-creancier"
            label={e.creditorId}
            hint={e.creditorIdHint}
            value={values.creditorId}
            error={errors['target.creditor']}
            onChange={(event) => onChange({ creditorId: event.target.value })}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * Formulaire d'une règle : création d'un brouillon (clé d'idempotence, nouvelle version d'une règle
 * publiée comprise) ou modification d'un brouillon. Contrôles locaux d'ADR-062 avant l'envoi.
 */
export function RuleEditor({
  initial,
  rule,
  previous,
  onSaved,
}: {
  initial: RuleValues;
  /** Brouillon modifié ; absent : création. */
  rule?: Rule;
  /** Règle publiée dont on crée une nouvelle version. */
  previous?: Rule;
  onSaved: (rule: Rule) => void;
}) {
  const [values, setValues] = useState(initial);
  const form = useFormSubmit(FIELDS);
  const idempotency = useIdempotencyKey();
  const change = (patch: Partial<RuleValues>) => setValues((current) => ({ ...current, ...patch }));

  function submit(event: FormEvent) {
    void form.submit(event, validateRule(values), async () => {
      const input = ruleInput(values, previous?.id);
      if (rule) {
        onSaved(await updateRule(rule.id, input));
        return e.saved;
      }
      try {
        const created = await createRule(input, idempotency.key());
        idempotency.settle();
        onSaved(created);
      } catch (error) {
        idempotency.settle(error);
        throw error;
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <TextField
        id="regle-libelle"
        label={e.label}
        hint={e.labelHint}
        value={values.label}
        maxLength={140}
        error={form.errors.label}
        onChange={(event) => change({ label: event.target.value })}
      />
      <RuleCalculation values={values} errors={form.errors} lockObject={!!previous} onChange={change} />
      <RuleTarget values={values} errors={form.errors} onChange={change} />
      <fieldset className="grid gap-3">
        <legend className="text-ink font-semibold">{e.validity}</legend>
        <p className="text-small text-ink-muted">{e.validityHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="regle-debut"
            type="date"
            label={e.validFrom}
            value={values.validFrom}
            error={form.errors.validFrom}
            onChange={(event) => change({ validFrom: event.target.value })}
          />
          <TextField
            id="regle-fin"
            type="date"
            label={e.validUntil}
            value={values.validUntil}
            error={form.errors.validUntil}
            onChange={(event) => change({ validUntil: event.target.value })}
          />
        </div>
      </fieldset>
      <FormFooter
        pending={form.pending}
        message={form.message}
        success={form.success}
        label={rule ? e.save : e.create}
      />
    </form>
  );
}
