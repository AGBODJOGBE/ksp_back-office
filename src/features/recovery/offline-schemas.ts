import * as z from 'zod/mini';
import { actorSchema, moneySchema } from './schemas';

/*
 * Paiements hors ligne (contrat `ksp-api.v1.yaml` : `RecoveryOfflinePayment`, page et validation),
 * champ par champ. Fichier à part : lu aussi par la section de Ma journée.
 */

const nullableString = z.nullable(z.string());

export const OFFLINE_STATUSES = ['pending_approval', 'approved', 'rejected'] as const;
export type OfflineStatus = (typeof OFFLINE_STATUSES)[number];

/** `RecoveryOfflinePayment` : saisie de la finance ou encaissement déclaré par un partenaire. */
export const offlinePaymentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseNumber: z.string(),
  source: z.enum(['cash', 'transfer', 'partner']),
  amount: moneySchema,
  receivedOn: z.string(),
  reference: nullableString,
  proofFileId: nullableString,
  status: z.enum(OFFLINE_STATUSES),
  recordedBy: actorSchema,
  approvedBy: z.nullable(actorSchema),
  rejectionReason: nullableString,
  collectionId: nullableString,
  createdAt: z.string(),
  partnerAssignmentId: nullableString,
});
export type OfflinePayment = z.infer<typeof offlinePaymentSchema>;

/** `RecoveryOfflinePaymentPage`. */
export const offlinePaymentPageSchema = z.object({
  payments: z.array(offlinePaymentSchema),
  nextCursor: nullableString,
});

/** `RecoveryOfflinePaymentApproved` : le paiement validé et l'encaissement imputé. */
export const offlinePaymentApprovedSchema = z.object({
  payment: offlinePaymentSchema,
  collection: z.object({ id: z.string(), gross: moneySchema, netToCreditor: moneySchema }),
});
