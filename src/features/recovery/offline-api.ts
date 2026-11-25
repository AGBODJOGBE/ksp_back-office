import type { Page } from '@/lib/use-paged-list';
import { PAGE_SIZE, path, read, send, xof } from './api';
import {
  type OfflinePayment,
  offlinePaymentApprovedSchema,
  offlinePaymentPageSchema,
  offlinePaymentSchema,
  type OfflineStatus,
} from './offline-schemas';

/*
 * Paiements hors ligne du Recouvrement (ADR-060, décision 8) : saisie par la finance, validation ou
 * refus par une autre personne (R-AR-03). Double authentification de moins de 10 minutes pour chaque
 * écriture. Remboursement d'un trop-perçu : `cases-api.ts`.
 */

export interface OfflineFilters {
  status?: OfflineStatus;
  caseId?: string;
}

/** Paiements hors ligne (saisies de la finance, encaissements déclarés par les partenaires). */
export function listOfflinePayments(filters: OfflineFilters = {}, limit = PAGE_SIZE) {
  return async (cursor?: string): Promise<Page<OfflinePayment>> => {
    const page = await read(offlinePaymentPageSchema, path('offline-payments'), {
      limit,
      ...filters,
      cursor,
    });
    return { data: page.payments, nextCursor: page.nextCursor };
  };
}

export interface OfflineInput {
  source: 'cash' | 'transfer';
  amount: number;
  receivedOn: string;
  reference?: string;
}

export function recordOfflinePayment(caseId: string, input: OfflineInput, key: string) {
  const { amount, ...rest } = input;
  return send(
    offlinePaymentSchema,
    'post',
    path('cases', caseId, 'offline-payments'),
    { ...rest, amount: xof(amount) },
    key,
  );
}

export const approveOfflinePayment = (id: string) =>
  send(offlinePaymentApprovedSchema, 'post', path('offline-payments', id, 'approve'), {});

export const rejectOfflinePayment = (id: string, reason: string) =>
  send(offlinePaymentSchema, 'post', path('offline-payments', id, 'reject'), { reason });
