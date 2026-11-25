import * as z from 'zod/mini';

/*
 * Factures lues par le back-office (contrat `ksp-api.v1.yaml`, routes `/api/v1/admin/billing/*`),
 * champ par champ : un champ obligatoire absent rend la réponse invalide, un champ ajouté est ignoré,
 * un état inconnu s'affiche avec un libellé neutre. Schémas lus dans le navigateur : `zod/mini`.
 */

/** `Money` : entiers de FCFA. */
const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

/** `InvoiceOrganization` : en-tête copié à l'émission (ADR-028), il ne suit pas la fiche. */
export const invoiceOrganizationSchema = z.object({
  legalName: z.string(),
  address: z.string(),
  ifu: z.string(),
  rccm: z.nullable(z.string()),
});

/** `InvoicePayment` : règlement enregistré (back-office, ou `mobile_money_online` par `system`). */
export const invoicePaymentSchema = z.object({
  id: z.string(),
  amount: moneySchema,
  method: z.string(),
  reference: z.nullable(z.string()),
  recordedBy: z.string(),
  recordedAt: z.string(),
});

/** `InvoiceLine` : ligne d'une facture ou d'un avoir (montants en FCFA). */
const lineSchema = z.object({
  label: z.string(),
  quantity: z.int(),
  unitPrice: moneySchema,
  amount: moneySchema,
});

/**
 * `CreditNote` : avoir sur une facture émise (R-PE-07). Il réduit d'abord le reste dû ; la part au-delà
 * (facture déjà payée) est créditée au portefeuille du titulaire.
 */
export const creditNoteSchema = z.object({
  id: z.string(),
  number: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  lines: z.array(lineSchema),
  total: moneySchema,
  reason: z.string(),
  /** Compte du back-office, ou `service:cleaning`. */
  issuedBy: z.string(),
  issuedAt: z.string(),
  appliedToBalance: moneySchema,
  creditedToWallet: moneySchema,
});

/** `Invoice` : facture mensuelle d'un contrat (pour le Nettoyage, une mission d'entreprise). */
export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  source: z.string(),
  contractId: z.string(),
  /** Rang du mois facturé dans le contrat. */
  periodIndex: z.int(),
  periodStart: z.string(),
  periodEnd: z.string(),
  lines: z.array(lineSchema),
  total: moneySchema,
  paid: moneySchema,
  balance: moneySchema,
  issuedAt: z.string(),
  dueAt: z.string(),
  paidAt: z.nullable(z.string()),
  payments: z.array(invoicePaymentSchema),
  /** `null` pour un particulier et pour une facture émise avant l'enregistrement de l'en-tête. */
  organization: z.nullable(invoiceOrganizationSchema),
  /** v2 : avoirs émis sur cette facture ; absent pour une facture v1. */
  creditNotes: z.optional(z.array(creditNoteSchema)),
});

export const invoiceListSchema = z.object({
  data: z.array(invoiceSchema),
  nextCursor: z.nullable(z.string()),
});

export const creditNoteListSchema = z.object({
  data: z.array(creditNoteSchema),
  nextCursor: z.nullable(z.string()),
});

/** `CreditNoteIssued` : avoir émis (ou retrouvé avec la même clé, `created: false`) et facture à jour. */
export const creditNoteIssuedSchema = z.object({
  creditNote: creditNoteSchema,
  invoice: invoiceSchema,
  created: z.boolean(),
});

/** `BillingSettings` : délai de règlement après l'émission (1 à 90 jours). */
export const billingSettingsSchema = z.object({
  paymentTermDays: z.int(),
  updatedBy: z.nullable(z.string()),
  updatedAt: z.nullable(z.string()),
});

export type Invoice = z.infer<typeof invoiceSchema>;
export type InvoiceList = z.infer<typeof invoiceListSchema>;
export type InvoicePayment = z.infer<typeof invoicePaymentSchema>;
export type BillingSettings = z.infer<typeof billingSettingsSchema>;
export type CreditNote = z.infer<typeof creditNoteSchema>;
export type CreditNoteList = z.infer<typeof creditNoteListSchema>;
export type CreditNoteIssued = z.infer<typeof creditNoteIssuedSchema>;
