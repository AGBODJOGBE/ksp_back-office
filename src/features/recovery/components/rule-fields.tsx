'use client';

import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { editorTexts } from '@/features/recovery/pricing-editor-texts';
import { MODES_BY_OBJECT, type RuleValues } from '@/features/recovery/pricing-form';
import { PRICING_OBJECTS, type PricingMode, type PricingObject } from '@/features/recovery/pricing-schemas';
import { modeLabel, objectLabel, pricingTexts } from '@/features/recovery/pricing-texts';
import { STAGE_GROUPS } from '@/features/recovery/schemas';
import { stageGroupLabel } from '@/features/recovery/texts';
import { TiersEditor } from './pricing-tiers';

const e = editorTexts;
const p = pricingTexts;

type Change = (patch: Partial<RuleValues>) => void;

/** Explication du mode choisi, selon l'objet (ADR-062, décisions 2 et 3). */
function modeHint(object: PricingObject, mode: PricingMode): string {
  if (mode === 'tiered')
    return object === 'recovery_commission' ? p.modes.tiered_commission : p.modes.tiered_fee;
  return p.modes[mode];
}

/**
 * Calcul d'une règle : objet, mode (limité à ceux que le service accepte pour l'objet), puis les
 * champs du mode (montant, taux, taux par étape, tranches) et les bornes, chacun expliqué en clair.
 */
export function RuleCalculation({
  values,
  errors,
  lockObject,
  onChange,
}: {
  values: RuleValues;
  errors: Record<string, string>;
  /** Nouvelle version : l'objet reste celui de la règle publiée. */
  lockObject: boolean;
  onChange: Change;
}) {
  const modes = MODES_BY_OBJECT[values.object];
  const commission = values.object === 'recovery_commission';
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="regle-objet"
          label={e.object}
          hint={p.objects[values.object]}
          value={values.object}
          disabled={lockObject}
          onChange={(event) => {
            const object = event.target.value as PricingObject;
            const allowed = MODES_BY_OBJECT[object];
            onChange({ object, mode: allowed.includes(values.mode) ? values.mode : allowed[0] });
          }}
        >
          {PRICING_OBJECTS.map((object) => (
            <option key={object} value={object}>
              {objectLabel(object)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="regle-mode"
          label={e.mode}
          hint={modeHint(values.object, values.mode)}
          value={values.mode}
          onChange={(event) => onChange({ mode: event.target.value as PricingMode })}
        >
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {modeLabel(mode)}
            </option>
          ))}
        </SelectField>
      </div>

      {values.mode === 'fixed' ? (
        <TextField
          id="regle-montant"
          label={e.fixedAmount}
          inputMode="numeric"
          value={values.fixedAmount}
          error={errors.fixedAmount}
          className="sm:max-w-xs"
          onChange={(event) => onChange({ fixedAmount: event.target.value })}
        />
      ) : null}

      {values.mode === 'percentage' ? (
        <TextField
          id="regle-taux"
          label={e.rate}
          hint={e.rateHint}
          inputMode="decimal"
          value={values.rate}
          error={errors.rateBps}
          className="sm:max-w-xs"
          onChange={(event) => onChange({ rate: event.target.value })}
        />
      ) : null}

      {values.mode === 'by_stage' ? (
        <fieldset className="grid gap-3">
          <legend className="text-ink font-semibold">{e.stageRates}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {STAGE_GROUPS.map((group, index) => (
              <TextField
                key={group}
                id={`regle-etape-${group}`}
                label={`${stageGroupLabel(group)} (%)`}
                inputMode="decimal"
                value={values.stageRates[group]}
                error={errors[`stageRates[${index}].rateBps`]}
                onChange={(event) =>
                  onChange({ stageRates: { ...values.stageRates, [group]: event.target.value } })
                }
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {values.mode === 'tiered' ? (
        <TiersEditor
          object={values.object}
          tiers={values.tiers}
          errors={errors}
          onChange={(tiers) => onChange({ tiers })}
        />
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="text-ink font-semibold">{p.bounds.title}</legend>
        <p className="text-small text-ink-muted">{commission ? p.bounds.commission : p.bounds.fee}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="regle-minimum"
            label={p.bounds.minimum}
            inputMode="numeric"
            value={values.minimum}
            error={errors.minimum}
            onChange={(event) => onChange({ minimum: event.target.value })}
          />
          <TextField
            id="regle-maximum"
            label={p.bounds.maximum}
            inputMode="numeric"
            value={values.maximum}
            error={errors.maximum}
            onChange={(event) => onChange({ maximum: event.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}
