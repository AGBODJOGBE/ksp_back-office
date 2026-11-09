import { api, parseResponse } from '@/lib/api';
import {
  type Payment,
  type PaymentList,
  paymentListSchema,
  paymentSchema,
  type Payout,
  type PayoutList,
  payoutListSchema,
  payoutSchema,
} from './schemas';

/**
 * Paiements en ligne du back-office : liste (`GET /api/v1/admin/payment/payments`) et traitement d'un
 * écart de montant (`POST /api/v1/admin/payment/payments/{id}/resolve-mismatch`, ADR-032).
 */
const PAYMENTS = '/api/v1/admin/payment/payments';

export const PAGE_SIZE = 20;

/** États filtrables (`PaymentStatus`), `amount_mismatch` d'abord : la finance doit le trancher. */
export const PAYMENT_STATUSES = [
  'amount_mismatch',
  'pending',
  'succeeded',
  'failed',
  'expired',
  'cancelled',
] as const;

/** Types d'objet payé (`PaymentSubjectType`, et `wallet_top_up` : recharge d'un portefeuille, ADR-046). */
export const SUBJECT_TYPES = ['cleaning_mission', 'billing_invoice', 'wallet_top_up'] as const;

/** Filtres de la liste, tous facultatifs et cumulables (gateway). */
export interface PaymentFilters {
  status?: string;
  subjectType?: string;
  subjectId?: string;
  /** `true` : écarts de montant pas encore traités par la finance (paramètre `underReview`). */
  underReview?: boolean;
}

export async function listPayments(
  filters: PaymentFilters,
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<PaymentList> {
  const { status, subjectType, subjectId, underReview } = filters;
  return parseResponse(
    paymentListSchema,
    await api.get(PAYMENTS, {
      query: { limit, cursor, status, subjectType, subjectId, underReview: underReview ? 'true' : undefined },
    }),
  );
}

/**
 * Traitement d'un écart de montant : la note dit ce que la finance a fait (1 à 500 caractères). Clé
 * d'idempotence facultative dans le contrat, toujours envoyée : tirée à l'ouverture de la boîte et
 * renvoyée telle quelle à chaque nouvel essai.
 */
export async function resolveMismatch(id: string, note: string, idempotencyKey: string): Promise<Payment> {
  return parseResponse(
    paymentSchema,
    await api.post(`${PAYMENTS}/${encodeURIComponent(id)}/resolve-mismatch`, { note }, { idempotencyKey }),
  );
}

const PAYOUTS = '/api/v1/admin/payment/payouts';

/** États filtrables d'un reversement (`PayoutStatus`), ceux qui attendent la finance d'abord. */
export const PAYOUT_STATUSES = ['requested', 'processing', 'completed', 'failed'] as const;

/** Reversements par Mobile Money (ADR-041), les plus récents d'abord, filtrables par état. */
export async function listPayouts(status: string | undefined, cursor?: string): Promise<PayoutList> {
  return parseResponse(
    payoutListSchema,
    await api.get(PAYOUTS, { query: { limit: PAGE_SIZE, cursor, status } }),
  );
}

/** Issue d'un reversement manuel : confirmé (référence du virement) ou déclaré en échec (raison). */
export type PayoutOutcome = { kind: 'confirm'; transferReference: string } | { kind: 'fail'; reason: string };

/**
 * Issue d'un reversement manuel : `confirm` avec la référence du virement fait par la finance (1 à 100
 * caractères), ou `fail` avec sa raison (1 à 500 caractères ; wallet rend alors le montant au
 * titulaire). Clé d'idempotence facultative dans le contrat, toujours envoyée : tirée à l'ouverture de
 * la boîte et renvoyée telle quelle à chaque nouvel essai.
 */
export async function settlePayout(
  id: string,
  outcome: PayoutOutcome,
  idempotencyKey: string,
): Promise<Payout> {
  const { kind, ...body } = outcome;
  return parseResponse(
    payoutSchema,
    await api.post(`${PAYOUTS}/${encodeURIComponent(id)}/${kind}`, body, { idempotencyKey }),
  );
}
