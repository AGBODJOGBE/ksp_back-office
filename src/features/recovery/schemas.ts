import * as z from 'zod/mini';

/*
 * Réponses de la gateway pour le Recouvrement du back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/recovery/*`, ADR-060 à ADR-064), champ par champ : un champ obligatoire absent rend la
 * réponse invalide, un champ ajouté par la gateway est ignoré. Énumérations du contrat telles quelles.
 * Schémas lus dans le navigateur : `zod/mini`.
 */

/** `Money` : entiers de FCFA, jamais de décimales. */
export const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });
export type Money = z.infer<typeof moneySchema>;

export const CASE_KINDS = ['b2b', 'b2c', 'rent'] as const;
export const CASE_STATUSES = [
  'draft',
  'awaiting_fee',
  'under_review',
  'info_requested',
  'active',
  'suspended',
  'closed',
  'rejected',
] as const;
export const CASE_STAGES = [
  'notice',
  'payment_plan',
  'amicable',
  'formal_notice',
  'bailiff',
  'litigation',
] as const;
export const STAGE_GROUPS = ['amicable', 'formal_notice', 'litigation'] as const;
export const DEADLINE_KINDS = [
  'notice_response',
  'plan_installment',
  'amicable_end',
  'formal_notice_end',
  'creditor_decision',
  'dispute_answer',
  'fee_payment',
  'info_completion',
  'review',
  'prescription',
  'promise',
  'partner_update',
] as const;
export const WORK_ITEM_KINDS = [
  'promised_callback',
  'broken_promise',
  'missed_installment',
  'reminder_due',
  'callback_request',
  'dispute',
  'plan_to_validate',
] as const;

export type CaseKind = (typeof CASE_KINDS)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CaseStage = (typeof CASE_STAGES)[number];
export type StageGroup = (typeof STAGE_GROUPS)[number];
export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number];

/** `RecoveryActor` : auteur d'une action (`userId` nul pour le débiteur et le système). */
export const actorSchema = z.object({
  type: z.enum(['staff', 'creditor', 'debtor', 'partner', 'system']),
  userId: z.nullable(z.string()),
  displayName: z.nullable(z.string()),
});
export type Actor = z.infer<typeof actorSchema>;

/** `RecoveryParty` : créancier (compte ou organisation). */
export const partySchema = z.object({
  type: z.enum(['user', 'organization']),
  id: z.string(),
  displayName: z.string(),
});

/** `RecoveryDeadline` : prochaine échéance d'un dossier. */
export const deadlineSchema = z.object({ kind: z.enum(DEADLINE_KINDS), dueAt: z.string() });

/** `RecoveryCaseSummary` : ligne d'un dossier (files, Ma journée). */
export const caseSummarySchema = z.object({
  id: z.string(),
  number: z.string(),
  kind: z.enum(CASE_KINDS),
  status: z.enum(CASE_STATUSES),
  stage: z.nullable(z.enum(CASE_STAGES)),
  creditor: partySchema,
  debtorName: z.string(),
  due: moneySchema,
  paid: moneySchema,
  score: z.nullable(z.int()),
  assignedAgent: z.nullable(actorSchema),
  nextDeadline: z.nullable(deadlineSchema),
  lastActionAt: z.nullable(z.string()),
  createdAt: z.string(),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

/** `RecoveryStageCount` : `stage` est une chaîne libre (étape, offre ou groupe d'étapes). */
const stageCountSchema = z.object({ stage: z.string(), count: z.int() });
export type StageCount = z.infer<typeof stageCountSchema>;

/** `RecoveryAgentPerformance`. */
const agentPerformanceSchema = z.object({
  agent: actorSchema,
  openCases: z.int(),
  recovered: moneySchema,
  recoveryRateBps: z.int(),
});
export type AgentPerformance = z.infer<typeof agentPerformanceSchema>;

/**
 * `RecoveryOverview` : tableau de bord. `recoveryRateByStageBps` reprend `RecoveryStageCount` : son
 * `count` y est un taux en points de base (1 000 = 10 %).
 */
export const overviewSchema = z.object({
  casesByStage: z.array(stageCountSchema),
  casesByKind: z.array(stageCountSchema),
  entrusted: moneySchema,
  recovered: moneySchema,
  recoveryRateBps: z.int(),
  recoveryRateByStageBps: z.array(stageCountSchema),
  agents: z.array(agentPerformanceSchema),
  installmentsDueToday: z.int(),
  promisesToCheck: z.int(),
  idleCases: z.int(),
  prescriptionsNear: z.int(),
  reviewQueue: z.int(),
  offlinePaymentsToApprove: z.int(),
});
export type Overview = z.infer<typeof overviewSchema>;

/** `RecoveryWorkItem` : ligne de la file de travail du chargé. */
export const workItemSchema = z.object({
  kind: z.enum(WORK_ITEM_KINDS),
  case: caseSummarySchema,
  dueAt: z.string(),
  note: z.nullable(z.string()),
});
export type WorkItem = z.infer<typeof workItemSchema>;

/** `RecoveryWorkQueue` : file triée par le service. */
export const workQueueSchema = z.object({ items: z.array(workItemSchema) });
export type WorkQueue = z.infer<typeof workQueueSchema>;
