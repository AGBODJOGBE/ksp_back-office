import * as z from 'zod/mini';
import { assignedAgentSchema, placeLocationSchema, typeRefSchema } from './requests-schemas';
import { page } from './schemas';

/*
 * Planning et affectations du Nettoyage v2 (sous-lot 1c-2), champ par champ d'après le contrat
 * `ksp-api.v1.yaml` (schémas `CleaningPlanning*`, `CleaningAssignment*`, `CleaningCheck*`,
 * `CleaningAutoPlanning*`). Mêmes règles que `schemas.ts` : champ obligatoire absent = réponse
 * invalide, champ ajouté ignoré.
 */

export const TARGET_KINDS = ['visit', 'session'] as const;
/** Contrôles d'une affectation (9.4), dans l'ordre du contrat. */
export const CHECKS = [
  'active',
  'skills',
  'zone',
  'availability',
  'unavailability',
  'conflict',
  'load',
  'team_size',
] as const;
/** Seuls contrôles contournables avec motif (`CleaningCheckOverride`). */
export const OVERRIDABLE_CHECKS = ['zone', 'availability', 'load', 'team_size'] as const;
export const ASSIGNMENT_STATUSES = [
  'proposed',
  'pending_confirmation',
  'confirmed',
  'declined',
  'expired',
  'removed',
] as const;
export const BATCH_WARNINGS = ['team_size_short', 'team_lead_missing'] as const;
export const AUTO_FAILURE_REASONS = ['no_candidate', 'team_incomplete', 'no_lead'] as const;

/** `CleaningAssignmentTarget` : visite ou séance concernée. */
export const targetSchema = z.object({ kind: z.enum(TARGET_KINDS), id: z.string() });

/** `CleaningCheckOverride` : contrôle contourné par le superviseur, avec motif. */
export const overrideSchema = z.object({ check: z.enum(OVERRIDABLE_CHECKS), reason: z.string() });

/** `CleaningScheduleConflict` : affectation qui chevauche, trajet compris. */
const conflictSchema = z.object({
  target: targetSchema,
  start: z.string(),
  end: z.string(),
  travelMinutes: z.int(),
});

/** `CleaningCheckResult` : résultat d'un contrôle. */
export const checkResultSchema = z.object({
  check: z.enum(CHECKS),
  passed: z.boolean(),
  overridable: z.boolean(),
  overridden: z.boolean(),
  missingSkills: z.array(z.string()),
  conflicts: z.array(conflictSchema),
  unavailabilityId: z.nullable(z.string()),
  unavailabilityStart: z.nullable(z.string()),
  unavailabilityEnd: z.nullable(z.string()),
});

/** `CleaningAgentCheck` : contrôles d'une affectation pour un agent. */
export const agentCheckSchema = z.object({
  agentId: z.string(),
  target: targetSchema,
  passed: z.boolean(),
  results: z.array(checkResultSchema),
});

/** `CleaningAssignment` : affectation d'un agent à une visite ou une séance. */
export const assignmentSchema = z.object({
  id: z.string(),
  target: targetSchema,
  agentId: z.string(),
  agentFirstName: z.string(),
  agentLastName: z.string(),
  isLead: z.boolean(),
  source: z.enum(['manual', 'auto']),
  status: z.enum(ASSIGNMENT_STATUSES),
  respondBefore: z.nullable(z.string()),
  overrides: z.array(overrideSchema),
  createdBy: z.nullable(z.string()),
  createdAt: z.string(),
  createdByName: z.nullable(z.string()),
});
export const assignmentListSchema = page(assignmentSchema);

/** `CleaningAssignmentBatch` : résultat d'une affectation (tout ou rien, sauf `skipFailing`). */
export const assignmentBatchSchema = z.object({
  assignments: z.array(assignmentSchema),
  checks: z.array(agentCheckSchema),
  warnings: z.array(z.enum(BATCH_WARNINGS)),
  batchId: z.nullable(z.string()),
  skipped: z.array(agentCheckSchema),
});

/** `CleaningAssignmentCheckReport` : contrôles sans rien enregistrer. */
export const checkReportSchema = z.object({ passed: z.boolean(), checks: z.array(agentCheckSchema) });

/** `CleaningPlanningItem` : visite ou séance au planning (9.6). */
export const planningItemSchema = z.object({
  kind: z.enum(TARGET_KINDS),
  id: z.string(),
  number: z.string(),
  rank: z.nullable(z.int()),
  status: z.string(),
  start: z.string(),
  end: z.string(),
  communeKey: z.string(),
  communeName: z.string(),
  location: z.nullable(placeLocationSchema),
  cleaningTypes: z.array(typeRefSchema),
  requiredSkills: z.array(z.string()),
  teamSize: z.int(),
  agents: z.array(assignedAgentSchema),
  late: z.boolean(),
  urgent: z.boolean(),
  suggestedStart: z.nullable(z.string()),
});
export const planningItemListSchema = page(planningItemSchema);

/** `CleaningAgentLoad` : charge d'un agent sur la période (minutes prévues / maximum). */
export const agentLoadSchema = z.object({
  agentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  plannedMinutes: z.int(),
  maxMinutes: z.int(),
});

/** `CleaningPlanning` : planning sur une période (`from` inclus, `to` exclu). */
export const planningSchema = z.object({
  from: z.string(),
  to: z.string(),
  items: z.array(planningItemSchema),
  loads: z.array(agentLoadSchema),
});

/** `CleaningAutoPlanningRun` : passage de la planification automatique (R-PL-01 à 07). */
export const autoPlanningRunSchema = z.object({
  id: z.string(),
  mode: z.enum(['proposal', 'automatic']),
  from: z.string(),
  to: z.string(),
  assigned: z.int(),
  proposed: z.int(),
  failures: z.array(z.object({ target: targetSchema, reason: z.enum(AUTO_FAILURE_REASONS) })),
  startedAt: z.string(),
});

export type TargetKind = (typeof TARGET_KINDS)[number];
export type CheckKind = (typeof CHECKS)[number];
export type OverridableCheck = (typeof OVERRIDABLE_CHECKS)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type BatchWarning = (typeof BATCH_WARNINGS)[number];
export type AutoFailureReason = (typeof AUTO_FAILURE_REASONS)[number];
export type AssignmentTarget = z.infer<typeof targetSchema>;
export type CheckOverride = z.infer<typeof overrideSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type AgentCheck = z.infer<typeof agentCheckSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignmentBatch = z.infer<typeof assignmentBatchSchema>;
export type CheckReport = z.infer<typeof checkReportSchema>;
export type PlanningItem = z.infer<typeof planningItemSchema>;
export type AgentLoad = z.infer<typeof agentLoadSchema>;
export type Planning = z.infer<typeof planningSchema>;
export type AutoPlanningRun = z.infer<typeof autoPlanningRunSchema>;
