import { beninDay } from '@/lib/format';
import type { RuleInput, TierInput } from './pricing-api';
import { editorTexts } from './pricing-editor-texts';
import type { Offer, PricingMode, PricingObject, Rule } from './pricing-schemas';
import { pricingTexts } from './pricing-texts';
import { type StageGroup, STAGE_GROUPS } from './schemas';
import { recoveryTexts } from './texts';

/*
 * Saisie d'une règle tarifaire (chaînes du formulaire) ↔ `RecoveryPricingRuleInput`. Contrôles locaux
 * repris d'ADR-062 (décision 5) pour signaler l'erreur sous le bon champ ; le service reste seul juge
 * (`RECOVERY_PRICING_RULE_INVALID`).
 */

const c = recoveryTexts.common;
const e = editorTexts;

/** Modes acceptés par le service pour chaque objet (domaine `pricing.ts`, ADR-062). */
export const MODES_BY_OBJECT: Record<PricingObject, readonly PricingMode[]> = {
  case_fee: ['fixed', 'tiered'],
  recovery_commission: ['percentage', 'tiered', 'by_stage', 'fixed'],
  study_fee: ['fixed'],
};

export const MAX_TIERS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMUNE = /^[a-z][a-z0-9-]{1,59}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface TierValues {
  /** Borne haute incluse ; ignorée pour la dernière tranche (sans limite). */
  upTo: string;
  /** Taux en % (commission) ou montant en F CFA (frais de dossier). */
  value: string;
}

export interface RuleValues {
  label: string;
  object: PricingObject;
  mode: PricingMode;
  fixedAmount: string;
  rate: string;
  tiers: TierValues[];
  stageRates: Record<StageGroup, string>;
  minimum: string;
  maximum: string;
  offer: Offer;
  communeKey: string;
  negotiated: boolean;
  creditorType: 'user' | 'organization';
  creditorId: string;
  validFrom: string;
  validUntil: string;
  /** Instants enregistrés (brouillon relu) : gardés tels quels tant que le jour ne change pas. */
  saved?: { validFrom: string; validUntil: string | null };
}

/** Une règle par tranches de taux (commission) ou de montants (frais de dossier) ? */
export const tiersAreRates = (object: PricingObject) => object === 'recovery_commission';

const percentText = (bps: number | null | undefined) =>
  bps === null || bps === undefined || bps < 0 ? '' : String(bps / 100).replace('.', ',');
const amountText = (money: { amount: number } | null | undefined) => (money ? String(money.amount) : '');

export function emptyRule(): RuleValues {
  return {
    label: '',
    object: 'recovery_commission',
    mode: 'percentage',
    fixedAmount: '',
    rate: '',
    tiers: [{ upTo: '', value: '' }],
    stageRates: { amicable: '', formal_notice: '', litigation: '' },
    minimum: '',
    maximum: '',
    offer: 'any',
    communeKey: '',
    negotiated: false,
    creditorType: 'organization',
    creditorId: '',
    validFrom: beninDay(new Date()),
    validUntil: '',
  };
}

/**
 * Valeurs d'une règle existante. Les tranches renvoyées portent toujours un taux et un montant (le champ
 * inutile vaut -1 ou 0) : seul l'objet dit lequel compte.
 */
export function ruleValues(rule: Rule): RuleValues {
  const rates = tiersAreRates(rule.object);
  const stage = (group: StageGroup) =>
    percentText(rule.stageRates.find((r) => r.stageGroup === group)?.rateBps);
  return {
    label: rule.label,
    object: rule.object,
    mode: rule.mode,
    fixedAmount: amountText(rule.fixedAmount),
    rate: percentText(rule.rateBps),
    tiers: rule.tiers.length
      ? rule.tiers.map((tier) => ({
          upTo: amountText(tier.upTo),
          value: rates ? percentText(tier.rateBps) : amountText(tier.fixedAmount),
        }))
      : [{ upTo: '', value: '' }],
    stageRates: {
      amicable: stage('amicable'),
      formal_notice: stage('formal_notice'),
      litigation: stage('litigation'),
    },
    minimum: amountText(rule.minimum),
    maximum: amountText(rule.maximum),
    offer: rule.target.offer,
    communeKey: rule.target.communeKey ?? '',
    negotiated: !!rule.target.creditor,
    creditorType: rule.target.creditor?.type ?? 'organization',
    creditorId: rule.target.creditor?.id ?? '',
    validFrom: beninDay(rule.validFrom),
    validUntil: rule.validUntil ? beninDay(rule.validUntil) : '',
    saved: { validFrom: rule.validFrom, validUntil: rule.validUntil },
  };
}

/** « 12,5 » → 1 250 points de base ; `null` hors de 0 à 100 % ou au-delà de deux décimales. */
export function parsePercent(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const bps = Math.round(Number(text) * 100);
  return bps >= 0 && bps <= 10000 ? bps : null;
}

/** Montant entier en F CFA (espaces tolérés) ; `null` sinon. */
export function parseAmount(value: string): number | null {
  const text = value.replace(/[\s  ]/g, '');
  if (!/^\d{1,13}$/.test(text)) return null;
  return Number(text);
}

/** Jour `AAAA-MM-JJ` → minuit au Bénin, en ISO 8601. */
export const dayToIso = (day: string) => new Date(`${day}T00:00:00+01:00`).toISOString();

/** Instant envoyé : celui déjà enregistré si le jour saisi n'a pas changé, sinon minuit au Bénin. */
const instant = (day: string, saved: string | null | undefined) =>
  saved && beninDay(saved) === day ? saved : dayToIso(day);

const money = (amount: number) => ({ amount, currency: 'XOF' as const });

/** Contrôles locaux : champ (chemin du contrat) → message. */
export function validateRule(values: RuleValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const label = values.label.trim();
  if (!label) errors.label = c.required;
  else if (label.length > 140) errors.label = c.tooLong(140);
  if (values.mode === 'fixed' && parseAmount(values.fixedAmount) === null)
    errors.fixedAmount = c.invalidAmount;
  if (values.mode === 'percentage' && parsePercent(values.rate) === null) errors.rateBps = c.invalidPercent;
  if (values.mode === 'by_stage') {
    STAGE_GROUPS.forEach((group, index) => {
      if (parsePercent(values.stageRates[group]) === null)
        errors[`stageRates[${index}].rateBps`] = c.invalidPercent;
    });
  }
  if (values.mode === 'tiered') Object.assign(errors, validateTiers(values));
  const minimum = values.minimum.trim() ? parseAmount(values.minimum) : 0;
  const maximum = values.maximum.trim() ? parseAmount(values.maximum) : 0;
  if (minimum === null) errors.minimum = c.invalidAmount;
  if (maximum === null) errors.maximum = c.invalidAmount;
  if (minimum && maximum && minimum > maximum) errors.minimum = pricingTexts.bounds.minAboveMax;
  if (values.communeKey.trim() && !COMMUNE.test(values.communeKey.trim()))
    errors['target.communeKey'] = e.invalidCommune;
  if (values.negotiated && !UUID.test(values.creditorId.trim())) errors['target.creditor'] = e.invalidUuid;
  if (!DAY.test(values.validFrom)) errors.validFrom = c.required;
  if (values.validUntil && (!DAY.test(values.validUntil) || values.validUntil <= values.validFrom)) {
    errors.validUntil = e.untilBeforeFrom;
  }
  return errors;
}

function validateTiers(values: RuleValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.tiers.length) errors.tiers = e.tiers.atLeastOne;
  if (values.tiers.length > MAX_TIERS) errors.tiers = e.tiers.max;
  const rates = tiersAreRates(values.object);
  let previous = 0;
  values.tiers.forEach((tier, index) => {
    const last = index === values.tiers.length - 1;
    if (!last) {
      const upTo = parseAmount(tier.upTo);
      if (upTo === null) errors[`tiers[${index}].upTo`] = c.invalidAmount;
      else if (upTo <= previous) errors[`tiers[${index}].upTo`] = e.tiers.notIncreasing;
      else previous = upTo;
    }
    const valid = rates ? parsePercent(tier.value) !== null : parseAmount(tier.value) !== null;
    if (!valid)
      errors[`tiers[${index}].${rates ? 'rateBps' : 'fixedAmount'}`] = rates
        ? c.invalidPercent
        : c.invalidAmount;
  });
  return errors;
}

/** Corps envoyé (valeurs déjà contrôlées) : seuls les champs du mode choisi. */
export function ruleInput(values: RuleValues, previousVersionId?: string): RuleInput {
  const rates = tiersAreRates(values.object);
  const tiers: TierInput[] = values.tiers.map((tier, index) => {
    const last = index === values.tiers.length - 1;
    const upTo = last ? null : money(parseAmount(tier.upTo) ?? 0);
    return rates
      ? { upTo, rateBps: parsePercent(tier.value) ?? 0 }
      : { upTo, fixedAmount: money(parseAmount(tier.value) ?? 0) };
  });
  const minimum = parseAmount(values.minimum);
  const maximum = parseAmount(values.maximum);
  return {
    object: values.object,
    mode: values.mode,
    ...(values.mode === 'fixed' ? { fixedAmount: money(parseAmount(values.fixedAmount) ?? 0) } : {}),
    ...(values.mode === 'percentage' ? { rateBps: parsePercent(values.rate) ?? 0 } : {}),
    ...(values.mode === 'tiered' ? { tiers } : {}),
    ...(values.mode === 'by_stage'
      ? {
          stageRates: STAGE_GROUPS.map((stageGroup) => ({
            stageGroup,
            rateBps: parsePercent(values.stageRates[stageGroup]) ?? 0,
          })),
        }
      : {}),
    ...(values.minimum.trim() && minimum !== null ? { minimum: money(minimum) } : {}),
    ...(values.maximum.trim() && maximum !== null ? { maximum: money(maximum) } : {}),
    target: {
      offer: values.offer,
      communeKey: values.communeKey.trim() || null,
      creditor: values.negotiated ? { type: values.creditorType, id: values.creditorId.trim() } : null,
    },
    validFrom: instant(values.validFrom, values.saved?.validFrom),
    ...(values.validUntil ? { validUntil: instant(values.validUntil, values.saved?.validUntil) } : {}),
    label: values.label.trim(),
    ...(previousVersionId ? { previousVersionId } : {}),
  };
}
