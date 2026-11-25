import * as z from 'zod/mini';
import { moneySchema } from './schemas';

/*
 * Factures de commission du recouvrement (ADR-064, routes `/api/v1/admin/billing/commission-invoices*`,
 * service billing) : une facture mensuelle par créancier, une ligne par encaissement, hors taxe.
 * Lecture seule au back-office.
 */

export const COMMISSION_INVOICE_STATUSES = ['pending_payment', 'paid', 'cancelled'] as const;
export const COLLECTION_SOURCES = [
  'payment_link',
  'offline_cash',
  'offline_transfer',
  'partner',
  'direct_to_creditor',
] as const;
export const SETTLEMENTS = ['deducted', 'invoiced'] as const;
export const DEBIT_FAILURES = ['insufficient_funds', 'wallet_error'] as const;

export type CommissionInvoiceStatus = (typeof COMMISSION_INVOICE_STATUSES)[number];

/** `CommissionInvoiceLine` : un encaissement du dossier (montants hors taxe). */
export const commissionLineSchema = z.object({
  caseId: z.string(),
  caseNumber: z.string(),
  collectionId: z.string(),
  receivedAt: z.string(),
  receivedOn: z.string(),
  source: z.enum(COLLECTION_SOURCES),
  gross: moneySchema,
  commission: moneySchema,
  settlement: z.enum(SETTLEMENTS),
});
export type CommissionLine = z.infer<typeof commissionLineSchema>;

/** `CommissionDebit` : débit automatique du portefeuille prépayé du créancier. */
export const commissionDebitSchema = z.object({
  attempts: z.int(),
  lastAttemptAt: z.nullable(z.string()),
  nextAttemptAt: z.nullable(z.string()),
  lastFailure: z.nullable(z.enum(DEBIT_FAILURES)),
  missing: z.nullable(moneySchema),
});
export type CommissionDebit = z.infer<typeof commissionDebitSchema>;

/** `InvoiceOrganization` : en-tête copié d'identity à l'émission. */
const invoiceOrganizationSchema = z.object({
  legalName: z.string(),
  address: z.string(),
  ifu: z.string(),
  rccm: z.nullable(z.string()),
});

/** `CommissionInvoice`. */
export const commissionInvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(COMMISSION_INVOICE_STATUSES),
  creditor: z.object({ type: z.enum(['user', 'organization']), id: z.string() }),
  period: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  lines: z.array(commissionLineSchema),
  totalCollected: moneySchema,
  commissionDeducted: moneySchema,
  commissionInvoiced: moneySchema,
  commissionTotal: moneySchema,
  balance: moneySchema,
  amountsExcludingTax: z.literal(true),
  issuedAt: z.string(),
  paidAt: z.nullable(z.string()),
  walletTransactionId: z.nullable(z.string()),
  debit: z.nullable(commissionDebitSchema),
  organization: z.nullable(invoiceOrganizationSchema),
});
export type CommissionInvoice = z.infer<typeof commissionInvoiceSchema>;

/** `CommissionInvoiceList` : liste par curseur, sans total. */
export const commissionInvoiceListSchema = z.object({
  data: z.array(commissionInvoiceSchema),
  nextCursor: z.nullable(z.string()),
});
