import * as z from 'zod/mini';
import { creditSchema, prepaidWalletSchema } from './schemas';

/*
 * Ce qui attend la finance dans les portefeuilles (contrat `ksp-api.v1.yaml`) : retraits vers Mobile
 * Money (`Withdrawal`, R-WL-04, ADR-055), demandes de crédit manuel au-delà du seuil de double
 * validation (`ManualCreditRequest`, ADR-048) et reversements demandés depuis les portefeuilles
 * (`WalletPayout`, ADR-041). Champ par champ ; les énumérations restent des chaînes (un état nouveau
 * s'affiche avec un libellé neutre au lieu de casser l'écran). Schémas lus dans le navigateur : `zod/mini`.
 */

/** `Money` : entiers de FCFA. */
const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

const holderSchema = z.object({ type: z.string(), id: z.string() });

/** `Withdrawal` : retrait du portefeuille prépayé vers Mobile Money, traité puis validé par deux personnes. */
export const withdrawalSchema = z.object({
  id: z.string(),
  holder: holderSchema,
  amount: moneySchema,
  status: z.string(),
  beneficiaryOperator: z.string(),
  /** Numéro masqué, par exemple `+229 •• •• 45`. */
  beneficiaryPhoneMasked: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  processedBy: z.nullable(z.string()),
  processedAt: z.nullable(z.string()),
  /** Vérifications notées par la première personne (back-office seulement). */
  processingNote: z.optional(z.nullable(z.string())),
  approvedBy: z.nullable(z.string()),
  approvedAt: z.nullable(z.string()),
  rejectedAt: z.nullable(z.string()),
  rejectionReason: z.nullable(z.string()),
  paymentPayoutId: z.nullable(z.string()),
  completedAt: z.nullable(z.string()),
  failedAt: z.nullable(z.string()),
});

export const withdrawalListSchema = z.object({
  data: z.array(withdrawalSchema),
  nextCursor: z.nullable(z.string()),
});

/** `WalletObjectRef` : objet réglé aussitôt par le crédit (facture), lu sans en dépendre. */
const objectRefSchema = z.object({ service: z.string(), objectType: z.string(), objectId: z.string() });

/** `ManualCreditRequest` : crédit manuel au-delà du seuil, en attente d'un second membre de la finance. */
export const creditRequestSchema = z.object({
  id: z.string(),
  holder: holderSchema,
  kind: z.string(),
  amount: moneySchema,
  reason: z.string(),
  paymentId: z.nullable(z.string()),
  status: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  approvedBy: z.nullable(z.string()),
  approvedAt: z.nullable(z.string()),
  transactionId: z.nullable(z.string()),
  /** v2 : reçu de caisse ou référence du virement. */
  receiptReference: z.optional(z.nullable(z.string())),
  forObject: z.optional(z.nullable(objectRefSchema)),
  rejectedBy: z.optional(z.nullable(z.string())),
  rejectedAt: z.optional(z.nullable(z.string())),
  rejectionReason: z.optional(z.nullable(z.string())),
});

/** `ManualCreditRequestList` : la liste est dans `items` (et non `data`), comme le contrat la nomme. */
export const creditRequestListSchema = z.object({
  items: z.array(creditRequestSchema),
  nextCursor: z.nullable(z.string()),
});

/** `ManualCreditApproval` : crédit écrit à la validation (`created: false` si la demande l'était déjà). */
export const creditApprovalSchema = z.object({
  transactionId: z.string(),
  kind: z.string(),
  amount: moneySchema,
  description: z.string(),
  createdAt: z.string(),
  wallet: prepaidWalletSchema,
  request: creditRequestSchema,
  created: z.boolean(),
});

/** `WalletCreditPending` : crédit au-delà du seuil, rien n'est crédité avant la validation. */
export const creditPendingSchema = z.object({
  pendingRequest: creditRequestSchema,
  wallet: prepaidWalletSchema,
  created: z.boolean(),
});

/** Réponse d'un crédit manuel : crédit écrit (`WalletCredit`), ou demande en attente au-delà du seuil. */
export const creditOutcomeSchema = z.union([creditSchema, creditPendingSchema]);

/** `WalletPayout` : reversement demandé depuis un portefeuille ; l'exécution se suit chez payment. */
export const walletPayoutSchema = z.object({
  id: z.string(),
  holder: holderSchema,
  amount: moneySchema,
  status: z.string(),
  paymentPayoutId: z.nullable(z.string()),
  beneficiaryOperator: z.string(),
  beneficiaryPhoneMasked: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.nullable(z.string()),
  failedAt: z.nullable(z.string()),
});

export const walletPayoutListSchema = z.object({
  data: z.array(walletPayoutSchema),
  nextCursor: z.nullable(z.string()),
});

export type Withdrawal = z.infer<typeof withdrawalSchema>;
export type WithdrawalList = z.infer<typeof withdrawalListSchema>;
export type ManualCredit = z.infer<typeof creditRequestSchema>;
export type ManualCreditList = z.infer<typeof creditRequestListSchema>;
export type CreditApproval = z.infer<typeof creditApprovalSchema>;
export type CreditPending = z.infer<typeof creditPendingSchema>;
export type CreditOutcome = z.infer<typeof creditOutcomeSchema>;
export type WalletPayout = z.infer<typeof walletPayoutSchema>;
export type WalletPayoutList = z.infer<typeof walletPayoutListSchema>;
