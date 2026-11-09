import { api, parseResponse } from '@/lib/api';
import {
  creditSchema,
  type MismatchedTopUp,
  mismatchedTopUpListSchema,
  overviewSchema,
  type Statement,
  statementSchema,
  type Wallet,
  type WalletCredit,
  type WalletOverview,
  walletSchema,
} from './schemas';

/**
 * Portefeuilles du back-office (contrat `ksp-api.v1.yaml`) : vue d'ensemble du grand livre, portefeuille
 * et relevé d'un titulaire, crédit manuel du portefeuille prépayé (ADR-046). Plus la lecture des
 * recharges en écart de montant d'un titulaire chez payment, pour choisir celle que la finance crédite.
 */
const ADMIN = '/api/v1/admin/wallet';

export const PAGE_SIZE = 20;

/** `WalletHolderType` : compte d'un particulier ou organisation (UUID d'identity). */
export type HolderType = 'user' | 'organization';

/** `WalletStatementAccount` : portefeuille prépayé, ou fonds dus au titulaire créancier. */
export type StatementAccount = 'prepaid' | 'collections';

const holderPath = (type: HolderType, id: string) => `${ADMIN}/holders/${type}/${encodeURIComponent(id)}`;

export async function getOverview(): Promise<WalletOverview> {
  return parseResponse(overviewSchema, await api.get(`${ADMIN}/overview`));
}

export async function getHolderWallet(type: HolderType, id: string): Promise<Wallet> {
  return parseResponse(walletSchema, await api.get(holderPath(type, id)));
}

export async function listStatement(
  type: HolderType,
  id: string,
  account: StatementAccount,
  cursor?: string,
): Promise<Statement> {
  return parseResponse(
    statementSchema,
    await api.get(`${holderPath(type, id)}/statement`, { query: { limit: PAGE_SIZE, cursor, account } }),
  );
}

/** `WalletCreditRequest` : remboursement, ou recharge reçue avec un écart (`paymentId` obligatoire). */
export type CreditRequest =
  | { kind: 'refund'; amount: number; reason: string }
  | { kind: 'top_up'; amount: number; reason: string; paymentId: string };

/**
 * Crédit manuel du portefeuille prépayé. Clé d'idempotence obligatoire : tirée à l'ouverture du
 * formulaire et renvoyée telle quelle à chaque nouvel essai (`created: false` si le crédit existait).
 */
export async function creditWallet(
  type: HolderType,
  id: string,
  { amount, ...request }: CreditRequest,
  idempotencyKey: string,
): Promise<WalletCredit> {
  return parseResponse(
    creditSchema,
    await api.post(
      `${holderPath(type, id)}/credits`,
      { ...request, amount: { amount, currency: 'XOF' } },
      { idempotencyKey },
    ),
  );
}

/**
 * Recharges du titulaire restées en écart de montant (`GET /api/v1/admin/payment/payments`, objet
 * `wallet_top_up` dont l'identifiant est le titulaire, ADR-046), les plus récentes d'abord.
 */
export async function listMismatchedTopUps(holderId: string): Promise<MismatchedTopUp[]> {
  const page = parseResponse(
    mismatchedTopUpListSchema,
    await api.get('/api/v1/admin/payment/payments', {
      query: { limit: 50, status: 'amount_mismatch', subjectType: 'wallet_top_up', subjectId: holderId },
    }),
  );
  return page.data;
}
