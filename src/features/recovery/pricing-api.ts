import { api, parseResponse } from '@/lib/api';
import { PAGE_SIZE, path, read, send } from './api';
import type { Money } from './schemas';
import {
  type Offer,
  type PricingMode,
  type PricingObject,
  type Rule,
  rulePageSchema,
  ruleSchema,
  type RuleStatus,
  type Simulation,
  simulationSchema,
  type StageRate,
} from './pricing-schemas';

/**
 * Règles tarifaires du recouvrement (ADR-062) : liste, fiche, brouillon (création avec clé
 * d'idempotence, modification), publication, validation d'une règle négociée, archivage, simulation.
 */

export interface RuleFilters {
  object?: PricingObject;
  status?: RuleStatus;
  offer?: Offer;
  creditorId?: string;
}

/** Une page de règles (`limit` 20, curseur opaque), au format des listes paginées du back-office. */
export function listRules(filters: RuleFilters = {}) {
  return async (cursor?: string) => {
    const page = await read(rulePageSchema, path('pricing-rules'), { limit: PAGE_SIZE, ...filters, cursor });
    return { data: page.rules, nextCursor: page.nextCursor };
  };
}

export const getRule = (id: string): Promise<Rule> => read(ruleSchema, path('pricing-rules', id));

/** Tranche envoyée (`RecoveryPricingTier`) : un taux ou un montant, jamais les deux. */
export interface TierInput {
  upTo: Money | null;
  rateBps?: number;
  fixedAmount?: Money;
}

/** `RecoveryPricingRuleInput` : seuls les champs du mode choisi sont envoyés. */
export interface RuleInput {
  object: PricingObject;
  mode: PricingMode;
  fixedAmount?: Money;
  rateBps?: number;
  tiers?: TierInput[];
  stageRates?: StageRate[];
  minimum?: Money;
  maximum?: Money;
  target: {
    offer: Offer;
    communeKey?: string | null;
    creditor?: { type: 'user' | 'organization'; id: string } | null;
  };
  validFrom: string;
  validUntil?: string;
  label: string;
  previousVersionId?: string;
}

/** Nouveau brouillon, ou nouvelle version d'une règle publiée (`previousVersionId`). */
export const createRule = (input: RuleInput, idempotencyKey: string): Promise<Rule> =>
  send(ruleSchema, 'post', path('pricing-rules'), input, idempotencyKey);

/** Modifier un brouillon (une règle publiée ne change plus). */
export const updateRule = (id: string, input: RuleInput): Promise<Rule> =>
  send(ruleSchema, 'put', path('pricing-rules', id), input);

/** Publier : une règle négociée pour un créancier passe d'abord `pending_approval` (R-TA-04). */
export const publishRule = async (id: string): Promise<Rule> =>
  parseResponse(ruleSchema, await api.post(path('pricing-rules', id, 'publish')));

/** Valider une règle négociée : par une autre personne que son auteur. */
export const approveRule = async (id: string): Promise<Rule> =>
  parseResponse(ruleSchema, await api.post(path('pricing-rules', id, 'approve')));

/** Archiver, avec un motif (3 à 500 caractères) ; les mandats signés gardent leur version. */
export const archiveRule = (id: string, reason: string): Promise<Rule> =>
  send(ruleSchema, 'post', path('pricing-rules', id, 'archive'), { reason });

export interface SimulationInput {
  ruleId?: string;
  object: PricingObject;
  target: RuleInput['target'];
  baseAmount: Money;
  stage?: string;
}

/** Effet d'une règle (brouillon compris) ou de la règle publiée applicable, sur un exemple. */
export const simulate = (input: SimulationInput): Promise<Simulation> =>
  send(simulationSchema, 'post', path('pricing-simulations'), input);
