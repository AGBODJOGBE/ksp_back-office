import * as z from 'zod/mini';
import { actorSchema, CASE_STAGES, moneySchema, STAGE_GROUPS } from './schemas';

/*
 * Tarification du recouvrement (ADR-062, routes `/api/v1/admin/recovery/pricing-rules*` et
 * `pricing-simulations`) : règles versionnées des frais de dossier, de la commission et du forfait
 * d'étude. Montants en entiers de FCFA, taux en points de base (1 000 = 10 %).
 */

export const PRICING_OBJECTS = ['case_fee', 'recovery_commission', 'study_fee'] as const;
export const PRICING_MODES = ['fixed', 'percentage', 'tiered', 'by_stage'] as const;
export const RULE_STATUSES = ['draft', 'pending_approval', 'published', 'archived'] as const;
export const OFFERS = ['b2b', 'b2c', 'rent', 'any'] as const;
export const BOUNDS_APPLIED = ['minimum', 'maximum'] as const;

export type PricingObject = (typeof PRICING_OBJECTS)[number];
export type PricingMode = (typeof PRICING_MODES)[number];
export type RuleStatus = (typeof RULE_STATUSES)[number];
export type Offer = (typeof OFFERS)[number];

/**
 * `RecoveryPricingTier` : borne haute incluse (`null` : dernière tranche, sans limite), et soit un taux
 * (commission, calcul progressif sur le cumul encaissé), soit un montant fixe (frais de dossier).
 */
export const tierSchema = z.object({
  upTo: z.nullable(moneySchema),
  rateBps: z.optional(z.int()),
  fixedAmount: z.optional(moneySchema),
});
export type Tier = z.infer<typeof tierSchema>;

/** `RecoveryStageRate` : taux d'un groupe d'étapes (`by_stage`). */
export const stageRateSchema = z.object({ stageGroup: z.enum(STAGE_GROUPS), rateBps: z.int() });
export type StageRate = z.infer<typeof stageRateSchema>;

/** `RecoveryPricingTarget` : offre, commune (`null` : toutes), créancier précis (tarif négocié). */
export const targetSchema = z.object({
  offer: z.enum(OFFERS),
  communeKey: z.optional(z.nullable(z.string())),
  creditor: z.optional(z.nullable(z.object({ type: z.enum(['user', 'organization']), id: z.string() }))),
});
export type Target = z.infer<typeof targetSchema>;

/** `RecoveryPricingRule`. */
export const ruleSchema = z.object({
  id: z.string(),
  object: z.enum(PRICING_OBJECTS),
  mode: z.enum(PRICING_MODES),
  fixedAmount: z.nullable(moneySchema),
  rateBps: z.nullable(z.int()),
  tiers: z.array(tierSchema),
  stageRates: z.array(stageRateSchema),
  minimum: z.nullable(moneySchema),
  maximum: z.nullable(moneySchema),
  target: targetSchema,
  validFrom: z.string(),
  validUntil: z.nullable(z.string()),
  version: z.int(),
  status: z.enum(RULE_STATUSES),
  label: z.string(),
  createdBy: actorSchema,
  approvedBy: z.nullable(actorSchema),
  publishedAt: z.nullable(z.string()),
  previousVersionId: z.nullable(z.string()),
});
export type Rule = z.infer<typeof ruleSchema>;

/** `RecoveryPricingRulePage` : liste par curseur, sans total. */
export const rulePageSchema = z.object({ rules: z.array(ruleSchema), nextCursor: z.nullable(z.string()) });

/** `RecoveryPricingSimulation` : détail ligne par ligne et borne appliquée (R-TA-01). */
export const simulationSchema = z.object({
  amount: moneySchema,
  ruleId: z.string(),
  ruleVersion: z.int(),
  lines: z.array(
    z.object({ label: z.string(), base: moneySchema, rateBps: z.nullable(z.int()), amount: moneySchema }),
  ),
  boundApplied: z.nullable(z.enum(BOUNDS_APPLIED)),
});
export type Simulation = z.infer<typeof simulationSchema>;

/** Étape envoyée au simulateur (`stage` du contrat) : l'amiable par défaut côté service. */
export const SIMULATION_STAGES = CASE_STAGES;
