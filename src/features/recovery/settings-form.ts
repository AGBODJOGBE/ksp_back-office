import { parseAmount, parsePercent } from './pricing-form';
import {
  DAY_SETTINGS,
  type DaySetting,
  SCALE_BOUNDS,
  SCALES,
  type ScaleKey,
  SCORE_CRITERIA,
  type ScoreCriterion,
  SETTING_BOUNDS,
  type Settings,
} from './settings-schemas';
import { settingsTexts } from './settings-texts';
import { recoveryTexts } from './texts';

/*
 * Saisie des réglages (chaînes du formulaire) ↔ `RecoverySettings`, avec les bornes du contrat vérifiées
 * avant l'envoi (`RECOVERY_SETTING_OUT_OF_BOUNDS` reste la décision du service). Pourcentages saisis en
 * %, envoyés en points de base.
 */

const c = recoveryTexts.common;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScaleValues {
  acceptsPaymentPlan: boolean;
  maxDurationMonths: string;
  minFirstPayment: string;
  firstPaymentWithinDays: string;
  minInstallment: string;
  maxDiscount: string;
}

export interface SettingsValues {
  minimumCaseAmount: string;
  days: Record<DaySetting, string>;
  contactStart: string;
  contactEnd: string;
  contactDays: number[];
  scales: Record<ScaleKey, ScaleValues>;
  weights: Record<ScoreCriterion, string>;
}

const percent = (bps: number) => String(bps / 100).replace('.', ',');

export function settingsValues(settings: Settings): SettingsValues {
  const scale = (key: ScaleKey): ScaleValues => {
    const value = settings[key];
    return {
      acceptsPaymentPlan: value.acceptsPaymentPlan,
      maxDurationMonths: String(value.maxDurationMonths),
      minFirstPayment: percent(value.minFirstPaymentBps),
      firstPaymentWithinDays: String(value.firstPaymentWithinDays),
      minInstallment: String(value.minInstallment.amount),
      maxDiscount: percent(value.maxDiscountBps),
    };
  };
  return {
    minimumCaseAmount: String(settings.minimumCaseAmount.amount),
    days: Object.fromEntries(DAY_SETTINGS.map((key) => [key, String(settings[key])])) as Record<
      DaySetting,
      string
    >,
    contactStart: settings.contactWindow.start,
    contactEnd: settings.contactWindow.end,
    contactDays: [...settings.contactWindow.days].sort((a, b) => a - b),
    scales: Object.fromEntries(SCALES.map((key) => [key, scale(key)])) as Record<ScaleKey, ScaleValues>,
    weights: Object.fromEntries(
      SCORE_CRITERIA.map((key) => [key, String(settings.scoreWeights[key])]),
    ) as Record<ScoreCriterion, string>,
  };
}

/** Entier dans des bornes, ou `null`. */
export function parseBounded(value: string, [min, max]: readonly [number, number]): number | null {
  if (!/^\d{1,6}$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return parsed >= min && parsed <= max ? parsed : null;
}

/** Contrôles locaux : champ (chemin du contrat) → message. */
export function validateSettings(values: SettingsValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (parseAmount(values.minimumCaseAmount) === null) errors.minimumCaseAmount = c.invalidAmount;
  for (const key of DAY_SETTINGS) {
    if (parseBounded(values.days[key], SETTING_BOUNDS[key]) === null)
      errors[key] = c.between(...SETTING_BOUNDS[key]);
  }
  const t = settingsTexts.contact;
  if (!TIME.test(values.contactStart)) errors['contactWindow.start'] = t.invalidTime;
  if (!TIME.test(values.contactEnd)) errors['contactWindow.end'] = t.invalidTime;
  if (!values.contactDays.length) errors['contactWindow.days'] = t.noDay;
  for (const key of SCALES) {
    const scale = values.scales[key];
    if (parseBounded(scale.maxDurationMonths, SCALE_BOUNDS.maxDurationMonths) === null) {
      errors[`${key}.maxDurationMonths`] = c.between(...SCALE_BOUNDS.maxDurationMonths);
    }
    if (parsePercent(scale.minFirstPayment) === null) errors[`${key}.minFirstPaymentBps`] = c.invalidPercent;
    if (parseBounded(scale.firstPaymentWithinDays, SCALE_BOUNDS.firstPaymentWithinDays) === null) {
      errors[`${key}.firstPaymentWithinDays`] = c.between(...SCALE_BOUNDS.firstPaymentWithinDays);
    }
    if (parseAmount(scale.minInstallment) === null) errors[`${key}.minInstallment`] = c.invalidAmount;
    if (parsePercent(scale.maxDiscount) === null) errors[`${key}.maxDiscountBps`] = c.invalidPercent;
  }
  for (const key of SCORE_CRITERIA) {
    if (parseBounded(values.weights[key], [0, 100]) === null)
      errors[`scoreWeights.${key}`] = c.between(0, 100);
  }
  return errors;
}

const xof = (amount: number) => ({ amount, currency: 'XOF' as const });

/** Réglages envoyés (valeurs déjà contrôlées). */
export function settingsInput(values: SettingsValues): Settings {
  const scale = (key: ScaleKey) => {
    const value = values.scales[key];
    return {
      acceptsPaymentPlan: value.acceptsPaymentPlan,
      maxDurationMonths: Number(value.maxDurationMonths),
      minFirstPaymentBps: parsePercent(value.minFirstPayment) ?? 0,
      firstPaymentWithinDays: Number(value.firstPaymentWithinDays),
      minInstallment: xof(parseAmount(value.minInstallment) ?? 0),
      maxDiscountBps: parsePercent(value.maxDiscount) ?? 0,
    };
  };
  const days = Object.fromEntries(DAY_SETTINGS.map((key) => [key, Number(values.days[key])])) as Record<
    DaySetting,
    number
  >;
  return {
    minimumCaseAmount: xof(parseAmount(values.minimumCaseAmount) ?? 0),
    ...days,
    contactWindow: {
      start: values.contactStart,
      end: values.contactEnd,
      days: [...values.contactDays].sort((a, b) => a - b),
    },
    defaultB2bScale: scale('defaultB2bScale'),
    defaultB2cScale: scale('defaultB2cScale'),
    defaultRentScale: scale('defaultRentScale'),
    scoreWeights: Object.fromEntries(
      SCORE_CRITERIA.map((key) => [key, Number(values.weights[key])]),
    ) as Settings['scoreWeights'],
  };
}
