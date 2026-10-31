import * as z from 'zod/mini';

/*
 * Paiements en ligne lus par le back-office (contrat `ksp-api.v1.yaml`, `GET /api/v1/admin/payment/payments`,
 * ADR-031), champ par champ. Les énumérations restent des chaînes : un nouvel état s'affiche avec un
 * libellé neutre au lieu de casser l'écran. Schémas lus dans le navigateur : `zod/mini`.
 */

const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

/** `PaymentSubject` : mission du Nettoyage (acompte ou reste dû) ou facture (numéro). */
export const paymentSubjectSchema = z.object({
  type: z.string(),
  id: z.string(),
  part: z.nullable(z.string()),
  reference: z.nullable(z.string()),
});

/** `Payment` : intention de paiement Mobile Money en ligne. */
export const paymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  subject: paymentSubjectSchema,
  amount: moneySchema,
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  method: z.string(),
  provider: z.string(),
  providerReference: z.nullable(z.string()),
  checkoutUrl: z.nullable(z.string()),
  failureReason: z.nullable(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
  completedAt: z.nullable(z.string()),
});

export const paymentListSchema = z.object({
  data: z.array(paymentSchema),
  nextCursor: z.nullable(z.string()),
});

export type Payment = z.infer<typeof paymentSchema>;
export type PaymentList = z.infer<typeof paymentListSchema>;
