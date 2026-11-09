import * as z from 'zod/mini';

/*
 * Portefeuilles lus par le back-office (contrat `ksp-api.v1.yaml`, routes `/api/v1/admin/wallet/*`,
 * ADR-042 et ADR-046), champ par champ. Les énumérations restent des chaînes : une nouvelle sorte
 * d'écriture s'affiche avec un libellé neutre au lieu de casser l'écran. Schémas lus dans le
 * navigateur : `zod/mini`.
 */

/** `Money` : entiers de FCFA. */
const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

const holderSchema = z.object({ type: z.string(), id: z.string() });

/** `PrepaidWallet` : portefeuille prépayé (ADR-046), dépensable, jamais négatif, jamais reversé. */
export const prepaidWalletSchema = z.object({
  holder: holderSchema,
  balance: moneySchema,
  lastEntryAt: z.nullable(z.string()),
});

/** `Wallet` : fonds dus au titulaire créancier (ADR-042) et, à part, son portefeuille prépayé. */
export const walletSchema = z.object({
  holder: holderSchema,
  balance: moneySchema,
  payoutsInProgress: moneySchema,
  totalCollected: moneySchema,
  totalPaidOut: moneySchema,
  lastEntryAt: z.nullable(z.string()),
  /** Absent d'une gateway antérieure au portefeuille prépayé. */
  prepaid: z.optional(prepaidWalletSchema),
});

/** `WalletStatementLine` : une écriture du relevé, immuable. */
export const statementLineSchema = z.object({
  transactionId: z.string(),
  account: z.string(),
  kind: z.string(),
  direction: z.string(),
  amount: moneySchema,
  balanceAfter: moneySchema,
  description: z.string(),
  /** Objet payé chez le service qui a débité (mission, facture) ; `null` sinon. */
  object: z.nullable(
    z.object({
      service: z.string(),
      objectType: z.string(),
      objectId: z.string(),
      part: z.nullable(z.string()),
    }),
  ),
  createdAt: z.string(),
});

export const statementSchema = z.object({
  data: z.array(statementLineSchema),
  nextCursor: z.nullable(z.string()),
});

/** `WalletCredit` : crédit manuel enregistré (ou retrouvé, `created: false`). */
export const creditSchema = z.object({
  transactionId: z.string(),
  kind: z.string(),
  amount: moneySchema,
  description: z.string(),
  createdAt: z.string(),
  wallet: prepaidWalletSchema,
  created: z.boolean(),
});

/** `WalletLedgerOverview` : comptes internes de KSP, dû aux créanciers et aux clients. */
export const overviewSchema = z.object({
  internalAccounts: z.array(z.object({ account: z.string(), balance: moneySchema })),
  owedToHolders: moneySchema,
  holdersCount: z.int(),
  owedToCustomers: z.optional(moneySchema),
  customersCount: z.optional(z.int()),
});

/**
 * Recharge Mobile Money restée en écart de montant (`Payment` du service payment, objet
 * `wallet_top_up`) : seuls les champs utiles au choix du paiement à créditer.
 */
export const mismatchedTopUpSchema = z.object({
  id: z.string(),
  amount: moneySchema,
  providerReference: z.nullable(z.string()),
  createdAt: z.string(),
  underReview: z.boolean(),
});

export const mismatchedTopUpListSchema = z.object({ data: z.array(mismatchedTopUpSchema) });

export type PrepaidWallet = z.infer<typeof prepaidWalletSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type StatementLine = z.infer<typeof statementLineSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type WalletCredit = z.infer<typeof creditSchema>;
export type WalletOverview = z.infer<typeof overviewSchema>;
export type MismatchedTopUp = z.infer<typeof mismatchedTopUpSchema>;
