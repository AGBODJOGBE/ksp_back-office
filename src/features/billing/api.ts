import { api, parseResponse } from '@/lib/api';
import {
  type BillingSettings,
  billingSettingsSchema,
  type Invoice,
  type InvoiceList,
  invoiceListSchema,
  invoiceSchema,
} from './schemas';

/**
 * Appels du navigateur à la gateway pour la facturation du back-office (`/api/v1/admin/billing/*`,
 * 5 routes). Option A (F-005) : jeton d'accès de la session. Le contrat ne prévoit pas de clé
 * d'idempotence sur le paiement manuel : le bouton est désactivé pendant l'envoi (**à valider**).
 */

const ADMIN = '/api/v1/admin/billing';
const INVOICES = `${ADMIN}/invoices`;

/** Taille d'une page (le contrat accepte 1 à 100, 20 par défaut). */
export const PAGE_SIZE = 20;

/** États filtrables (`InvoiceStatus`). */
export const INVOICE_STATUSES = ['pending_payment', 'overdue', 'paid', 'cancelled'] as const;

/** Moyens d'un paiement manuel (`InvoicePaymentMethod`). */
export const MANUAL_METHODS = ['cash', 'bank_transfer', 'mobile_money_offline'] as const;
export type ManualMethod = (typeof MANUAL_METHODS)[number];

/** Filtres de la liste, tous facultatifs et cumulables (gateway). */
export interface InvoiceFilters {
  status?: string;
  organizationId?: string;
  contractId?: string;
}

const at = (id: string, action = '') => `${INVOICES}/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

export async function listInvoices(filters: InvoiceFilters, cursor?: string): Promise<InvoiceList> {
  const { status, organizationId, contractId } = filters;
  return parseResponse(
    invoiceListSchema,
    await api.get(INVOICES, { query: { limit: PAGE_SIZE, cursor, status, organizationId, contractId } }),
  );
}

export async function getInvoice(id: string): Promise<Invoice> {
  return parseResponse(invoiceSchema, await api.get(at(id)));
}

export async function recordInvoicePayment(
  id: string,
  input: { amount: number; method: ManualMethod; reference?: string },
): Promise<Invoice> {
  return parseResponse(invoiceSchema, await api.post(at(id, 'payments'), input));
}

export async function getBillingSettings(): Promise<BillingSettings> {
  return parseResponse(billingSettingsSchema, await api.get(`${ADMIN}/settings`));
}

export async function updateBillingSettings(paymentTermDays: number): Promise<BillingSettings> {
  return parseResponse(billingSettingsSchema, await api.put(`${ADMIN}/settings`, { paymentTermDays }));
}
