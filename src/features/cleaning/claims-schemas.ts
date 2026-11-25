import * as z from 'zod/mini';
import { photoSchema } from './requests-schemas';
import { hiddenMoney, page } from './schemas';

/*
 * Réclamations du Nettoyage v2 (sous-lot 1c-4), champ par champ d'après le contrat `ksp-api.v1.yaml`
 * (schémas `CleaningClaim`, `CleaningClaimMessage`, `CleaningClaimDecision`, `CleaningClaimList`).
 * Mêmes règles que `schemas.ts` : champ obligatoire absent = réponse invalide, champ ajouté ignoré,
 * montant facultatif (absent sans `cleaning.amounts.read`).
 */

export const CLAIM_STATUSES = ['open', 'in_progress', 'resolved', 'rejected'] as const;
export const CLAIM_CATEGORIES = ['incomplete_work', 'damage', 'behavior', 'missing_item', 'other'] as const;
export const CLAIM_OUTCOMES = ['free_redo', 'wallet_credit', 'rejected'] as const;
export const CLAIM_APPROVAL_STATUSES = ['not_required', 'pending', 'approved'] as const;
export const CLAIM_SORTS = ['openedAt', '-openedAt'] as const;

/** `CleaningClaimMessage` : échange avec le client, dans l'ordre chronologique. */
export const claimMessageSchema = z.object({
  id: z.string(),
  author: z.enum(['customer', 'staff']),
  authorId: z.string(),
  text: z.string(),
  at: z.string(),
});

/** `CleaningClaimDecision` : repasse gratuite, crédit (validé par une deuxième personne au-delà du seuil) ou rejet. */
export const claimDecisionSchema = z.object({
  outcome: z.enum(CLAIM_OUTCOMES),
  creditAmount: hiddenMoney,
  redoSessionId: z.nullable(z.string()),
  reason: z.string(),
  decidedBy: z.string(),
  decidedAt: z.string(),
  approvalStatus: z.enum(CLAIM_APPROVAL_STATUSES),
  approvedBy: z.nullable(z.string()),
  decidedByName: z.nullable(z.string()),
});

/** `CleaningClaim` : réclamation sur une séance (partie 12). */
export const claimSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  programId: z.string(),
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  category: z.enum(CLAIM_CATEGORIES),
  text: z.string(),
  photos: z.array(photoSchema),
  status: z.enum(CLAIM_STATUSES),
  messages: z.array(claimMessageSchema),
  decision: z.nullable(claimDecisionSchema),
  openedAt: z.string(),
  /** Objectif : 24 h après l'ouverture. */
  firstResponseAt: z.nullable(z.string()),
  closedAt: z.nullable(z.string()),
  customerName: z.nullable(z.string()),
  organizationName: z.nullable(z.string()),
});

export const claimListSchema = page(claimSchema);

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];
export type ClaimSort = (typeof CLAIM_SORTS)[number];
export type ClaimMessage = z.infer<typeof claimMessageSchema>;
export type ClaimDecision = z.infer<typeof claimDecisionSchema>;
export type Claim = z.infer<typeof claimSchema>;
