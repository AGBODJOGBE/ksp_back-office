/**
 * Réponses TEST des réclamations (sous-lot 1c-4), au format du contrat `ksp-api.v1.yaml`
 * (`CleaningClaim`, `CleaningClaimMessage`, `CleaningClaimDecision`).
 */
import { xof } from './fake-gateway.test-utils';

const id = (suffix: string) => `0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d${suffix}`;

export const claimIds = {
  claim: id('8001'),
  session: id('8002'),
  program: id('8003'),
  customer: id('8004'),
  message: id('8005'),
  staff: id('8006'),
  redo: id('8007'),
  photo: id('8008'),
};

/** Réclamation « travail incomplet » d'un particulier, ouverte le 21 novembre 2026, sans réponse. */
export function claim(overrides: Record<string, unknown> = {}) {
  return {
    id: claimIds.claim,
    sessionId: claimIds.session,
    programId: claimIds.program,
    customerId: claimIds.customer,
    organizationId: null,
    category: 'incomplete_work',
    text: 'La cuisine n’a pas été nettoyée.',
    photos: [
      {
        fileId: claimIds.photo,
        kind: 'claim',
        takenAt: '2026-11-21T09:00:00Z',
        url: 'https://files.test/claim.jpg',
        urlExpiresAt: '2026-11-21T10:00:00Z',
      },
    ],
    status: 'open',
    messages: [
      {
        id: claimIds.message,
        author: 'customer',
        authorId: claimIds.customer,
        text: 'Merci de me rappeler.',
        at: '2026-11-21T09:05:00Z',
      },
    ],
    decision: null,
    openedAt: '2026-11-21T09:00:00Z',
    firstResponseAt: null,
    closedAt: null,
    customerName: 'Afi Mensah',
    organizationName: null,
    ...overrides,
  };
}

/** Décision de crédit au-delà du seuil, en attente d'une deuxième personne. */
export function creditDecision(overrides: Record<string, unknown> = {}) {
  return {
    outcome: 'wallet_credit',
    creditAmount: xof(60_000),
    redoSessionId: null,
    reason: 'Cuisine non faite',
    decidedBy: claimIds.staff,
    decidedAt: '2026-11-22T10:00:00Z',
    approvalStatus: 'pending',
    approvedBy: null,
    decidedByName: 'Ama Houngbo',
    ...overrides,
  };
}
