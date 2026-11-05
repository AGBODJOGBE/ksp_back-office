import { api, parseResponse } from '@/lib/api';
import { type Payment, type PaymentList, paymentListSchema, paymentSchema } from './schemas';

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

/** Types d'objet payé (`PaymentSubjectType`). */
export const SUBJECT_TYPES = ['cleaning_mission', 'billing_invoice'] as const;

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
