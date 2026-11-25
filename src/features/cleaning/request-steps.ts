import type { CleaningRequest, Quote, Visit } from './requests-schemas';

/**
 * Où en est un dossier (partie 15.2) : l'étape de la frise et l'action suivante de l'équipe, lues sur
 * son statut et son contenu. Aucune règle de transition ici : la gateway reste seule juge.
 */

export const STEPS = ['request', 'visit', 'retained', 'quote', 'follow'] as const;
export type StepKey = (typeof STEPS)[number];
export type StepState = 'done' | 'current' | 'todo' | 'stopped';

/** Dossier clos sans programme : refusé, annulé, devis décliné ou expiré. */
const CLOSED = ['declined', 'expired', 'cancelled', 'rejected'] as const;
export const isClosed = (request: CleaningRequest) => (CLOSED as readonly string[]).includes(request.status);

/**
 * Brouillon de devis en cours : il vit dans `quoteHistory` (brouillons visibles du back-office). À
 * valider : l'ordre de `quoteHistory` n'est pas fixé par le contrat, on prend la version la plus haute.
 */
export function draftQuote(request: CleaningRequest): Quote | null {
  const drafts = request.quoteHistory.filter((quote) => quote.status === 'draft');
  return drafts.reduce<Quote | null>(
    (best, quote) => (!best || quote.version > best.version ? quote : best),
    null,
  );
}

/** Visite encore à faire (planifiée ou commencée), la plus récente d'abord dans `visits`. */
export const openVisit = (request: CleaningRequest): Visit | null =>
  request.visits.find((visit) => visit.status === 'scheduled' || visit.status === 'in_progress') ?? null;

/** Dernier constat de l'agent (visite clôturée la plus récente), `null` s'il n'y en a pas. */
export const latestObserved = (request: CleaningRequest) =>
  request.visits.find((visit) => visit.status === 'completed' && visit.observedValues)?.observedValues ??
  null;

/** Étape où le dossier est arrêté quand il est clos : la dernière qu'il a atteinte. */
function reachedStep(request: CleaningRequest): StepKey {
  if (request.currentQuote || request.quoteHistory.length) return 'quote';
  if (request.retained) return 'retained';
  if (request.visits.length) return 'visit';
  return 'request';
}

/** Étape en cours du dossier. */
export function currentStep(request: CleaningRequest): StepKey {
  switch (request.status) {
    case 'awaiting_visit_fee':
      return request.visits.length ? 'visit' : 'request';
    case 'visit_to_schedule':
    case 'visit_scheduled':
    case 'visit_missed':
      return 'visit';
    case 'visit_done':
      return draftQuote(request) ? 'quote' : 'retained';
    case 'quote_sent':
      return 'quote';
    case 'accepted':
      return 'follow';
    default:
      return reachedStep(request);
  }
}

/** État de chaque étape de la frise. */
export function stepStates(request: CleaningRequest): Record<StepKey, StepState> {
  const current = STEPS.indexOf(currentStep(request));
  const pending = request.reactivation?.status === 'pending';
  const stopped = isClosed(request) && !pending;
  return Object.fromEntries(
    STEPS.map((step, index) => [
      step,
      index < current ? 'done' : index > current ? 'todo' : stopped ? 'stopped' : 'current',
    ]),
  ) as Record<StepKey, StepState>;
}

export type NextActionKey =
  | 'decideReactivation'
  | 'waitFee'
  | 'scheduleVisit'
  | 'waitVisit'
  | 'retain'
  | 'composeQuote'
  | 'approveAdjustment'
  | 'sendQuote'
  | 'waitCustomer'
  | 'openProgram'
  | 'accepted'
  | 'closed';

/** Action suivante et l'étape où elle se fait ; `action` : l'équipe a quelque chose à faire. */
export function nextAction(request: CleaningRequest): { key: NextActionKey; step: StepKey; action: boolean } {
  if (request.reactivation?.status === 'pending') {
    return { key: 'decideReactivation', step: 'request', action: true };
  }
  const draft = draftQuote(request);
  switch (request.status) {
    case 'awaiting_visit_fee':
    case 'visit_missed':
      return { key: 'waitFee', step: currentStep(request), action: false };
    case 'visit_to_schedule':
      return { key: 'scheduleVisit', step: 'visit', action: true };
    case 'visit_scheduled':
      return { key: 'waitVisit', step: 'visit', action: false };
    case 'visit_done':
      if (!request.retained) return { key: 'retain', step: 'retained', action: true };
      if (!draft) return { key: 'composeQuote', step: 'retained', action: true };
      return draftAction(draft);
    case 'quote_sent':
      return draft ? draftAction(draft) : { key: 'waitCustomer', step: 'quote', action: false };
    case 'accepted':
      return request.programId
        ? { key: 'openProgram', step: 'follow', action: true }
        : { key: 'accepted', step: 'follow', action: false };
    default:
      return { key: 'closed', step: currentStep(request), action: false };
  }
}

/** Une remise en attente de validation bloque l'envoi (`CLEANING_QUOTE_APPROVAL_REQUIRED`). */
export const awaitsApproval = (quote: Quote) =>
  quote.adjustments.some((adjustment) => adjustment.approvalStatus === 'pending');

function draftAction(draft: Quote) {
  return awaitsApproval(draft)
    ? { key: 'approveAdjustment' as const, step: 'quote' as const, action: true }
    : { key: 'sendQuote' as const, step: 'quote' as const, action: true };
}
