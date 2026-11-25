import { api, parseResponse } from '@/lib/api';
import { type AmountInput, listPage, path, read } from './api';
import {
  type Claim,
  claimListSchema,
  claimSchema,
  type ClaimOutcome,
  type ClaimSort,
  type ClaimStatus,
} from './claims-schemas';

/**
 * Appels du Nettoyage v2, sous-lot 1c-4 : réclamations (`/api/v1/admin/cleaning/claims`). Chaque
 * réponse est validée par son schéma. Les trois gestes portent la clé d'idempotence exigée par le
 * contrat, tirée par l'écran à l'ouverture du formulaire et renvoyée telle quelle à chaque essai.
 */

/** Filtres de `GET /claims` (tous facultatifs). */
export interface ClaimFilters {
  status?: ClaimStatus;
  /** Agent de la séance. */
  agentId?: string;
  customerId?: string;
  organizationId?: string;
  /** `openedAt` (défaut, plus anciennes d'abord) ou `-openedAt`. */
  sort?: ClaimSort;
}

export const listClaims = (filters: ClaimFilters = {}) =>
  listPage(claimListSchema, path('claims'), { ...filters });

/** Nombre de réclamations qui correspondent aux filtres (`total`), lu sur une page d'un élément. */
export const countClaims = async (filters: ClaimFilters): Promise<number> =>
  (await read(claimListSchema, path('claims'), { ...filters, limit: 1 })).total;

export const getClaim = (id: string): Promise<Claim> => read(claimSchema, path('claims', id));

/** `CleaningUpdateClaimBody` : passer « en cours » et/ou écrire au client (2 000 caractères au plus). */
export interface UpdateClaimBody {
  status?: 'in_progress';
  message?: string;
}

export const updateClaim = async (id: string, body: UpdateClaimBody, key: string): Promise<Claim> =>
  parseResponse(claimSchema, await api.patch(path('claims', id), body, { idempotencyKey: key }));

/** `CleaningDecideClaimBody` : décision motivée (500 caractères au plus) ; montant pour un crédit seulement. */
export interface DecideClaimBody {
  outcome: ClaimOutcome;
  reason: string;
  creditAmount?: AmountInput;
}

export const decideClaim = async (id: string, body: DecideClaimBody, key: string): Promise<Claim> =>
  parseResponse(claimSchema, await api.post(path('claims', id, 'decision'), body, { idempotencyKey: key }));

/** Validation d'un crédit en attente par une deuxième personne, autre que l'auteur de la décision. */
export const approveClaimCredit = async (id: string, key: string): Promise<Claim> =>
  parseResponse(
    claimSchema,
    await api.post(path('claims', id, 'decision', 'approve'), undefined, { idempotencyKey: key }),
  );
