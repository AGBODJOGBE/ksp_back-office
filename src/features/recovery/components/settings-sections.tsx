'use client';

import { FieldError, TextField } from '@/components/ui/field';
import type { ScaleValues, SettingsValues } from '@/features/recovery/settings-form';
import {
  DAY_SETTINGS,
  SCALE_BOUNDS,
  type ScaleKey,
  SCORE_CRITERIA,
  SETTING_BOUNDS,
} from '@/features/recovery/settings-schemas';
import {
  DAY_SETTING_TEXTS,
  SCALE_TITLES,
  SCORE_TEXTS,
  settingsTexts,
  WEEK_DAYS,
} from '@/features/recovery/settings-texts';

const t = settingsTexts;

type Errors = Record<string, string>;
type Change = (patch: Partial<SettingsValues>) => void;

const LEGEND = 'text-ink font-display text-h3 font-semibold';

/** Délais et seuils entiers, chacun avec ses bornes du contrat. */
export function DelaySettings({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: SettingsValues;
  errors: Errors;
  disabled: boolean;
  onChange: Change;
}) {
  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className={LEGEND}>{t.delays}</legend>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DAY_SETTINGS.map((key) => {
          const [min, max] = SETTING_BOUNDS[key];
          const { label, unit } = DAY_SETTING_TEXTS[key];
          return (
            <TextField
              key={key}
              id={`reglage-${key}`}
              label={`${label} (${unit})`}
              hint={t.bounds(min, max, unit)}
              inputMode="numeric"
              value={values.days[key]}
              error={errors[key]}
              onChange={(event) => onChange({ days: { ...values.days, [key]: event.target.value } })}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

/** Plage de contact du débiteur : heures (Bénin) et jours de la semaine. */
export function ContactWindow({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: SettingsValues;
  errors: Errors;
  disabled: boolean;
  onChange: Change;
}) {
  const toggle = (day: number, checked: boolean) =>
    onChange({
      contactDays: checked
        ? [...values.contactDays, day]
        : values.contactDays.filter((value) => value !== day),
    });
  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className={LEGEND}>{t.contact.title}</legend>
      <p className="text-small text-ink-muted">{t.contact.lead}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="reglage-contact-debut"
          type="time"
          label={t.contact.start}
          value={values.contactStart}
          error={errors['contactWindow.start']}
          onChange={(event) => onChange({ contactStart: event.target.value })}
        />
        <TextField
          id="reglage-contact-fin"
          type="time"
          label={t.contact.end}
          value={values.contactEnd}
          error={errors['contactWindow.end']}
          onChange={(event) => onChange({ contactEnd: event.target.value })}
        />
      </div>
      <fieldset
        className="grid gap-2"
        aria-describedby={errors['contactWindow.days'] ? 'reglage-jours-erreur' : undefined}
      >
        <legend className="text-ink font-semibold">{t.contact.days}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WEEK_DAYS.map((name, index) => (
            <label key={name} className="text-ink inline-flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="accent-action size-5"
                checked={values.contactDays.includes(index + 1)}
                aria-invalid={errors['contactWindow.days'] ? true : undefined}
                onChange={(event) => toggle(index + 1, event.target.checked)}
              />
              {name}
            </label>
          ))}
        </div>
        {errors['contactWindow.days'] ? (
          <FieldError id="reglage-jours-erreur">{errors['contactWindow.days']}</FieldError>
        ) : null}
      </fieldset>
    </fieldset>
  );
}

/** Barème d'échéancier par défaut d'une offre (`RecoveryPlanScale`). */
function ScaleFields({
  scaleKey,
  value,
  errors,
  onChange,
}: {
  scaleKey: ScaleKey;
  value: ScaleValues;
  errors: Errors;
  onChange: (value: ScaleValues) => void;
}) {
  const field = (name: keyof ScaleValues, error: string, label: string, hint?: string) => (
    <TextField
      id={`${scaleKey}-${name}`}
      label={label}
      hint={hint}
      inputMode={name === 'minFirstPayment' || name === 'maxDiscount' ? 'decimal' : 'numeric'}
      value={String(value[name])}
      error={errors[`${scaleKey}.${error}`]}
      onChange={(event) => onChange({ ...value, [name]: event.target.value })}
    />
  );
  const bounds = (key: keyof typeof SCALE_BOUNDS, unit: string) =>
    t.bounds(SCALE_BOUNDS[key][0], SCALE_BOUNDS[key][1], unit);
  return (
    <fieldset className="rounded-card border-line grid gap-4 border p-4">
      <legend className="text-ink px-1 font-semibold">{SCALE_TITLES[scaleKey]}</legend>
      <label className="text-ink inline-flex min-h-11 items-center gap-2 font-semibold">
        <input
          type="checkbox"
          className="accent-action size-5"
          checked={value.acceptsPaymentPlan}
          onChange={(event) => onChange({ ...value, acceptsPaymentPlan: event.target.checked })}
        />
        {t.scales.accepts}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          'maxDurationMonths',
          'maxDurationMonths',
          t.scales.maxDurationMonths,
          bounds('maxDurationMonths', 'mois'),
        )}
        {field('minFirstPayment', 'minFirstPaymentBps', t.scales.minFirstPayment)}
        {field(
          'firstPaymentWithinDays',
          'firstPaymentWithinDays',
          t.scales.firstPaymentWithinDays,
          bounds('firstPaymentWithinDays', 'jours'),
        )}
        {field('minInstallment', 'minInstallment', t.scales.minInstallment)}
        {field('maxDiscount', 'maxDiscountBps', t.scales.maxDiscount)}
      </div>
    </fieldset>
  );
}

export function PlanScales({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: SettingsValues;
  errors: Errors;
  disabled: boolean;
  onChange: Change;
}) {
  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className={LEGEND}>{t.scales.title}</legend>
      <p className="text-small text-ink-muted">{t.scales.lead}</p>
      <div className="grid gap-4 xl:grid-cols-3">
        {(Object.keys(values.scales) as ScaleKey[]).map((key) => (
          <ScaleFields
            key={key}
            scaleKey={key}
            value={values.scales[key]}
            errors={errors}
            onChange={(scale) => onChange({ scales: { ...values.scales, [key]: scale } })}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function ScoreWeights({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: SettingsValues;
  errors: Errors;
  disabled: boolean;
  onChange: Change;
}) {
  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className={LEGEND}>{t.score.title}</legend>
      <p className="text-small text-ink-muted">{t.score.lead}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCORE_CRITERIA.map((key) => (
          <TextField
            key={key}
            id={`score-${key}`}
            label={SCORE_TEXTS[key]}
            inputMode="numeric"
            value={values.weights[key]}
            error={errors[`scoreWeights.${key}`]}
            onChange={(event) => onChange({ weights: { ...values.weights, [key]: event.target.value } })}
          />
        ))}
      </div>
    </fieldset>
  );
}
