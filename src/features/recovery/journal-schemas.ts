import * as z from 'zod/mini';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from './case-schemas';
import { actorSchema, moneySchema } from './schemas';

/*
 * Journal de preuve et remise (contrat `ksp-api.v1.yaml` : `RecoveryJournalEntry`,
 * `RecoverySettlement`), champ par champ. Paiements hors ligne : `offline-schemas.ts`.
 */

const nullableString = z.nullable(z.string());

export const JOURNAL_KINDS = [
  'contact',
  'message_sent',
  'letter',
  'promise',
  'payment',
  'plan',
  'decision',
  'stage_changed',
  'status_changed',
  'dispute',
  'document',
  'partner_act',
  'note',
  'system',
] as const;

/** `RecoveryJournalEntry` : une action horodatée et attribuée, en ajout seul. */
export const journalEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(JOURNAL_KINDS),
  channel: z.nullable(z.enum(CONTACT_CHANNELS)),
  direction: z.nullable(z.enum(['outbound', 'inbound'])),
  outcome: z.nullable(z.enum(CONTACT_OUTCOMES)),
  deliveryStatus: z.nullable(z.enum(['sent', 'delivered', 'read', 'failed'])),
  summary: z.string(),
  amount: z.nullable(moneySchema),
  author: actorSchema,
  internal: z.boolean(),
  documentId: nullableString,
  fileId: nullableString,
  occurredAt: z.string(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

/** `RecoveryJournalPage`. */
export const journalPageSchema = z.object({
  entries: z.array(journalEntrySchema),
  nextCursor: nullableString,
});

/** `RecoverySettlement` : remise proposée (paiement immédiat d'une partie, le reste abandonné). */
export const settlementSchema = z.object({
  id: z.string(),
  payNow: moneySchema,
  waived: moneySchema,
  discountBps: z.int(),
  validUntil: z.string(),
  status: z.enum(['proposed', 'pending_creditor', 'accepted', 'rejected', 'executed', 'expired']),
});
export type Settlement = z.infer<typeof settlementSchema>;
