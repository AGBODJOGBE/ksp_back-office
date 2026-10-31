import { api, parseResponse } from '@/lib/api';
import { type PaymentList, paymentListSchema } from './schemas';

/** Paiements en ligne du back-office (`GET /api/v1/admin/payment/payments`, lecture seule). */
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
}

export async function listPayments(
  filters: PaymentFilters,
  cursor?: string,
  limit = PAGE_SIZE,
): Promise<PaymentList> {
  const { status, subjectType, subjectId } = filters;
  return parseResponse(
    paymentListSchema,
    await api.get(PAYMENTS, { query: { limit, cursor, status, subjectType, subjectId } }),
  );
}
