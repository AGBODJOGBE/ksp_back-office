import { beninDay } from '@/lib/format';
import type { Case, PlanRhythm, PlanScale } from './case-schemas';
import { CASE_PARAMS, type CaseFilterKey } from './paths';
import { CASE_KINDS, CASE_STAGES, CASE_STATUSES, type CaseStage } from './schemas';
import type { CaseQuery } from './cases-api';

/*
 * Règles d'affichage des dossiers (aucune décision métier : la gateway et le service restent juges).
 * Filtres de la file lus dans l'adresse, étapes de la fiche (ADR-060, décision 3), étapes vers
 * lesquelles un dossier peut être déplacé depuis le back-office, estimation d'un échéancier.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = (values: readonly string[]) => (raw: string) => (values.includes(raw) ? raw : undefined);

/** Contrôles du contrat par filtre ; une valeur hors contrat est ignorée (non envoyée). */
const FILTERS: Record<CaseFilterKey, (raw: string) => string | number | boolean | undefined> = {
  status: oneOf(CASE_STATUSES),
  stage: oneOf(CASE_STAGES),
  kind: oneOf(CASE_KINDS),
  agentId: (raw) => (UUID.test(raw) ? raw : undefined),
  creditorId: (raw) => (UUID.test(raw) ? raw : undefined),
  communeKey: (raw) => (raw.trim() && raw.length <= 60 ? raw.trim() : undefined),
  search: (raw) => (raw.trim().length >= 3 && raw.length <= 100 ? raw.trim() : undefined),
  idleDays: (raw) => {
    const days = /^\d{1,3}$/.test(raw) ? Number(raw) : 0;
    return days >= 1 && days <= 365 ? days : undefined;
  },
  prescriptionNear: (raw) => (raw === 'true' ? true : undefined),
};

/** Filtres de la file lus dans l'adresse (`CASE_PARAMS`), prêts pour `GET /recovery/cases`. */
export function readCaseFilters(params: { get: (name: string) => string | null }): CaseQuery {
  const filters: CaseQuery = {};
  for (const key of Object.keys(CASE_PARAMS) as CaseFilterKey[]) {
    const raw = params.get(CASE_PARAMS[key]);
    const value = raw === null ? undefined : FILTERS[key](raw);
    if (value !== undefined) filters[key] = value;
  }
  return filters;
}

/** Étapes amiables livrées ; au-delà (mise en demeure, huissier, judiciaire) : contentieux, R5. */
export const AMICABLE_STAGES = ['notice', 'payment_plan', 'amicable'] as const satisfies readonly CaseStage[];
const LITIGATION: readonly string[] = ['formal_notice', 'bailiff', 'litigation'];
export const isLitigation = (stage: string | null) => !!stage && LITIGATION.includes(stage);

/**
 * Étapes proposées au changement : les étapes amiables qui suivent l'étape actuelle (`notice` →
 * `payment_plan` → `amicable`, ou `notice` → `amicable`). Retour en arrière et sauts : jamais proposés
 * (« à valider ») ; un refus du service s'affiche.
 */
export function stageTargets(item: Pick<Case, 'status' | 'stage'>): CaseStage[] {
  if (item.status !== 'active' || !item.stage) return [];
  const index = (AMICABLE_STAGES as readonly string[]).indexOf(item.stage);
  return index < 0 ? [] : AMICABLE_STAGES.slice(index + 1);
}

export type StepState = 'done' | 'current' | 'upcoming';
export type StepId = 'review' | 'notice' | 'payment_plan' | 'amicable' | 'litigation';
export const STEP_IDS: readonly StepId[] = ['review', 'notice', 'payment_plan', 'amicable', 'litigation'];

/** État de chaque étape de la fiche, dans l'ordre du métier : recevabilité, puis étapes du dossier. */
export function caseSteps(item: Pick<Case, 'status' | 'stage'>): Record<StepId, StepState> {
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, 'upcoming'])) as Record<StepId, StepState>;
  if (['draft', 'awaiting_fee'].includes(item.status)) return steps;
  if (['under_review', 'info_requested', 'rejected'].includes(item.status)) {
    return { ...steps, review: 'current' };
  }
  const current: StepId | null = isLitigation(item.stage) ? 'litigation' : (item.stage as StepId | null);
  const at = current ? STEP_IDS.indexOf(current) : STEP_IDS.length;
  STEP_IDS.forEach((id, index) => {
    if (index < at) steps[id] = 'done';
    else if (index === at) steps[id] = item.status === 'closed' ? 'done' : 'current';
  });
  return steps;
}

const DAY = 86_400_000;

/** Jour `AAAA-MM-JJ` décalé de `days` jours ou `months` mois (fin de mois gardée : 31 janv. + 1 mois → 28 févr.). */
function shift(day: string, { days = 0, months = 0 }: { days?: number; months?: number }): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (months) {
    const target = date.getUTCMonth() + months;
    const last = new Date(Date.UTC(date.getUTCFullYear(), target + 1, 0, 12)).getUTCDate();
    date.setUTCDate(Math.min(date.getUTCDate(), last));
    date.setUTCMonth(target);
  }
  return new Date(date.getTime() + days * DAY).toISOString().slice(0, 10);
}

const STEP: Record<PlanRhythm, { days?: number; months?: number }> = {
  weekly: { days: 7 },
  biweekly: { days: 14 },
  monthly: { months: 1 },
};

export interface PlanEstimate {
  rest: number;
  installment: number;
  lastDueDate: string;
  firstMinimum: number;
  firstLatest: string;
  durationLimit: string;
  issues: ('first_payment' | 'installment_minimum' | 'duration')[];
}

/**
 * Estimation locale d'un échéancier face au barème du dossier, avant l'envoi : reste à étaler,
 * échéance moyenne arrondie à l'unité supérieure, dernière échéance. Indicative seulement (« à
 * valider ») : le service calcule les échéances, et sa réponse dit seule si le plan est dans le barème.
 */
export function estimatePlan(
  due: number,
  scale: PlanScale,
  terms: { firstAmount: number; firstDueDate: string; rhythm: PlanRhythm; installmentsCount: number },
  today: string = beninDay(new Date()),
): PlanEstimate {
  const rest = Math.max(due - terms.firstAmount, 0);
  const installment = Math.ceil(rest / terms.installmentsCount);
  const step = STEP[terms.rhythm];
  const lastDueDate = shift(terms.firstDueDate, {
    days: (step.days ?? 0) * terms.installmentsCount,
    months: (step.months ?? 0) * terms.installmentsCount,
  });
  const firstMinimum = Math.ceil((due * scale.minFirstPaymentBps) / 10_000);
  const firstLatest = shift(today, { days: scale.firstPaymentWithinDays });
  const durationLimit = shift(today, { months: scale.maxDurationMonths });
  const issues: PlanEstimate['issues'] = [];
  if (terms.firstAmount < firstMinimum || terms.firstDueDate > firstLatest) issues.push('first_payment');
  if (rest > 0 && installment < scale.minInstallment.amount) issues.push('installment_minimum');
  if (lastDueDate > durationLimit) issues.push('duration');
  return { rest, installment, lastDueDate, firstMinimum, firstLatest, durationLimit, issues };
}
