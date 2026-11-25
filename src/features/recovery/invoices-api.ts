import { PAGE_SIZE, read } from './api';
import {
  type CommissionInvoice,
  commissionInvoiceListSchema,
  commissionInvoiceSchema,
  type CommissionInvoiceStatus,
} from './invoice-schemas';

/** Factures de commission du recouvrement (service billing, ADR-064) : lecture seule. */
const BILLING = '/api/v1/admin/billing/commission-invoices';

export interface CommissionInvoiceFilters {
  status?: CommissionInvoiceStatus;
  /** Mois facturé AAAA-MM (heure du Bénin). */
  period?: string;
  creditorId?: string;
}

/** Une page de factures, les plus récentes d'abord. */
export function listCommissionInvoices(filters: CommissionInvoiceFilters = {}) {
  return (cursor?: string) =>
    read(commissionInvoiceListSchema, BILLING, { limit: PAGE_SIZE, ...filters, cursor });
}

export const getCommissionInvoice = (id: string): Promise<CommissionInvoice> =>
  read(commissionInvoiceSchema, `${BILLING}/${encodeURIComponent(id)}`);
