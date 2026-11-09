import * as z from 'zod/mini';

/*
 * Historique des envois et modèles de messages lus par le back-office (contrat `ksp-api.v1.yaml`,
 * `/api/v1/admin/notification/…`, ADR-039), champ par champ. Les énumérations restent des chaînes : un
 * nouveau canal ou état s'affiche avec un libellé neutre au lieu de casser l'écran.
 */

/** `NotificationDelivery` : un envoi, sans texte ni variables (jamais conservés), destinataire masqué. */
export const deliverySchema = z.object({
  id: z.string(),
  templateCode: z.string(),
  requestedChannel: z.string(),
  channelUsed: z.nullable(z.string()),
  channelsTried: z.array(z.string()),
  targetMasked: z.nullable(z.string()),
  recipientUserId: z.nullable(z.string()),
  status: z.string(),
  errorCode: z.nullable(z.string()),
  failureReason: z.nullable(z.string()),
  providerMessageId: z.nullable(z.string()),
  createdAt: z.string(),
  expiresAt: z.nullable(z.string()),
  acceptedAt: z.nullable(z.string()),
  failedAt: z.nullable(z.string()),
  /** Envoi détaché d'un compte supprimé (ADR-036). */
  erased: z.boolean(),
});

export const deliveryListSchema = z.object({
  data: z.array(deliverySchema),
  nextCursor: z.nullable(z.string()),
});

/** `NotificationTemplate` : texte rendu avec le nom des variables entre accolades. */
export const templateSchema = z.object({
  code: z.string(),
  kind: z.string(),
  channels: z.array(z.string()),
  secret: z.boolean(),
  optional: z.boolean(),
  variables: z.array(z.string()),
  optionalVariables: z.array(z.string()),
  subject: z.nullable(z.string()),
  text: z.nullable(z.string()),
});

export const templateListSchema = z.object({ data: z.array(templateSchema) });

export type Delivery = z.infer<typeof deliverySchema>;
export type DeliveryList = z.infer<typeof deliveryListSchema>;
export type MessageTemplate = z.infer<typeof templateSchema>;
