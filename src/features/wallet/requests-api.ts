import { api, parseResponse } from '@/lib/api';
import { type HolderType, PAGE_SIZE } from './api';
import {
  type CreditApproval,
  creditApprovalSchema,
  creditRequestListSchema,
  creditRequestSchema,
  type ManualCredit,
  type ManualCreditList,
  type WalletPayoutList,
  walletPayoutListSchema,
  type Withdrawal,
  type WithdrawalList,
  withdrawalListSchema,
  withdrawalSchema,
} from './requests-schemas';

/**
 * Ce qui attend la finance dans les portefeuilles (`/api/v1/admin/wallet/*`) : retraits (R-WL-04),
 * demandes de crédit manuel (ADR-048) et reversements des titulaires (ADR-041).
 *
 * Le contrat ne prévoit **aucune clé d'idempotence** sur ces décisions : chaque transition est gardée
 * par le service (`…_INVALID_TRANSITION`, `…_NOT_PENDING`), la validation est rejouable, et le bouton
 * est désactivé pendant l'envoi (**à valider**).
 */
const ADMIN = '/api/v1/admin/wallet';
const WITHDRAWALS = `${ADMIN}/withdrawals`;
const CREDIT_REQUESTS = `${ADMIN}/credit-requests`;

/** États d'un retrait (`WithdrawalStatus`), ceux qui attendent la finance d'abord. */
export const WITHDRAWAL_STATUSES = [
  'requested',
  'awaiting_approval',
  'submitted',
  'completed',
  'failed',
  'rejected',
] as const;

/** États d'une demande de crédit (`ManualCreditRequestStatus`). */
export const CREDIT_REQUEST_STATUSES = ['pending_approval', 'approved', 'rejected'] as const;

/** États d'un reversement des titulaires (`WalletPayoutStatus`). */
export const WALLET_PAYOUT_STATUSES = ['pending_submission', 'submitted', 'completed', 'failed'] as const;

/** Titulaire filtré : `holderType` et `holderId` vont ensemble (contrat). */
export interface HolderFilter {
  type: HolderType;
  id: string;
}

export interface ListFilters {
  status?: string;
  holder?: HolderFilter;
}

const holderQuery = (holder?: HolderFilter) => ({ holderType: holder?.type, holderId: holder?.id });
const at = (base: string, id: string, action: string) => `${base}/${encodeURIComponent(id)}/${action}`;

/** Retraits, les plus anciens d'abord (contrat), filtrables par état et par titulaire. */
export async function listWithdrawals(
  { status, holder }: ListFilters,
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<WithdrawalList> {
  return parseResponse(
    withdrawalListSchema,
    await api.get(WITHDRAWALS, { query: { limit, cursor, status, ...holderQuery(holder) } }),
  );
}

/** Première personne : vérifications faites (`requested` → `awaiting_approval`), note obligatoire. */
export async function processWithdrawal(id: string, note: string): Promise<Withdrawal> {
  return parseResponse(withdrawalSchema, await api.post(at(WITHDRAWALS, id, 'process'), { note }));
}

/** Deuxième personne, jamais celle qui a traité : virement transmis à payment (`submitted`). Rejouable. */
export async function approveWithdrawal(id: string): Promise<Withdrawal> {
  return parseResponse(withdrawalSchema, await api.post(at(WITHDRAWALS, id, 'approve')));
}

/** Refus motivé d'un retrait `requested` ou `awaiting_approval` : montant rendu, client prévenu. */
export async function rejectWithdrawal(id: string, reason: string): Promise<Withdrawal> {
  return parseResponse(withdrawalSchema, await api.post(at(WITHDRAWALS, id, 'reject'), { reason }));
}

/** Demandes de crédit manuel, les plus récentes d'abord, filtrables par état. */
export async function listCreditRequests(
  status: string | undefined,
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<ManualCreditList> {
  return parseResponse(
    creditRequestListSchema,
    await api.get(CREDIT_REQUESTS, { query: { limit, cursor, status } }),
  );
}

/** Validation par un membre de la finance autre que l'auteur : le portefeuille est crédité. Rejouable. */
export async function approveCreditRequest(id: string): Promise<CreditApproval> {
  return parseResponse(creditApprovalSchema, await api.post(at(CREDIT_REQUESTS, id, 'approve')));
}

/** Rejet motivé d'une demande en attente : rien n'est crédité. */
export async function rejectCreditRequest(id: string, reason: string): Promise<ManualCredit> {
  return parseResponse(creditRequestSchema, await api.post(at(CREDIT_REQUESTS, id, 'reject'), { reason }));
}

/** Reversements demandés depuis les portefeuilles, filtrables par état et par titulaire. */
export async function listWalletPayouts(
  { status, holder }: ListFilters,
  cursor?: string,
): Promise<WalletPayoutList> {
  return parseResponse(
    walletPayoutListSchema,
    await api.get(`${ADMIN}/payouts`, {
      query: { limit: PAGE_SIZE, cursor, status, ...holderQuery(holder) },
    }),
  );
}
