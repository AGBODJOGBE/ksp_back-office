import { api, parseResponse } from '@/lib/api';
import { listPage, path, read } from './api';
import {
  type AssignmentBatch,
  assignmentBatchSchema,
  assignmentListSchema,
  type AssignmentTarget,
  type AutoPlanningRun,
  autoPlanningRunSchema,
  type CheckOverride,
  type CheckReport,
  checkReportSchema,
  type Planning,
  planningItemListSchema,
  planningSchema,
} from './planning-schemas';

/**
 * Appels du Nettoyage v2, sous-lot 1c-2 : planning, colonne « à affecter », affectations, planification
 * automatique et propositions (`/api/v1/admin/cleaning/{planning,assignments}`). Chaque réponse est
 * validée par son schéma. Clé d'idempotence (tirée par l'écran, renvoyée telle quelle à chaque nouvel
 * essai) là où le contrat l'exige : affecter, désaffecter, planifier automatiquement, valider des
 * propositions. Sans clé : contrôle (rien n'est enregistré), remplacement ou chef d'équipe (PATCH).
 */

/** Filtres de `GET /planning` : période obligatoire (`from` inclus, `to` exclu), le reste facultatif. */
export interface PlanningFilters {
  from: string;
  to: string;
  agentId?: string;
  teamId?: string;
  zoneKey?: string;
  programId?: string;
}

export const getPlanning = (filters: PlanningFilters): Promise<Planning> =>
  read(planningSchema, path('planning'), { ...filters });

/** Colonne « à affecter » : visites à planifier et séances sans équipe complète, les plus proches d'abord. */
export const listUnassigned = (zoneKey?: string) =>
  listPage(planningItemListSchema, path('planning', 'unassigned'), { zoneKey, sort: 'urgency' });

/** Propositions de la planification automatique (statut `proposed`), par date de début. */
export const listProposals = (zoneKey?: string) =>
  listPage(assignmentListSchema, path('planning', 'proposals'), { zoneKey, sort: 'start' });

/**
 * `CleaningCheckAssignmentBody` : cibles (visite ou séances), agents **ou** équipe, chef d'équipe
 * (obligatoire au-delà d'un agent), contrôles contournés avec motif.
 */
export interface AssignmentBody {
  targets: AssignmentTarget[];
  agentIds?: string[];
  teamId?: string;
  leadAgentId?: string;
  overrides?: CheckOverride[];
}

/** Contrôler une affectation sans l'enregistrer. */
export const checkAssignment = async (body: AssignmentBody): Promise<CheckReport> =>
  parseResponse(checkReportSchema, await api.post(path('assignments', 'check'), body));

/** `CleaningCreateAssignmentsBody` : mêmes champs, plus `skipFailing` (cibles en échec écartées). */
export type CreateAssignmentsBody = AssignmentBody & { skipFailing?: boolean };

export const createAssignments = async (
  body: CreateAssignmentsBody,
  idempotencyKey: string,
): Promise<AssignmentBatch> =>
  parseResponse(assignmentBatchSchema, await api.post(path('assignments'), body, { idempotencyKey }));

/** `CleaningUpdateAssignmentBody` : remplaçant ou chef d'équipe, motif obligatoire. */
export interface UpdateAssignmentBody {
  replaceWithAgentId?: string;
  isLead?: boolean;
  overrides?: CheckOverride[];
  reason: string;
}

export const updateAssignment = async (id: string, body: UpdateAssignmentBody): Promise<AssignmentBatch> =>
  parseResponse(assignmentBatchSchema, await api.patch(path('assignments', id), body));

/** Désaffecter un agent (204) : la séance repasse « à affecter » si son équipe devient incomplète. */
export const removeAssignment = (id: string, reason: string, idempotencyKey: string): Promise<void> =>
  api.post(path('assignments', id, 'remove'), { reason }, { idempotencyKey });

/** `CleaningRunAutoPlanningBody` : tout facultatif (défaut : maintenant → horizon des réglages). */
export interface AutoPlanningBody {
  from?: string;
  to?: string;
  zoneKey?: string;
  programId?: string;
}

export const runAutoPlanning = async (
  body: AutoPlanningBody,
  idempotencyKey: string,
): Promise<AutoPlanningRun> =>
  parseResponse(autoPlanningRunSchema, await api.post(path('planning', 'auto'), body, { idempotencyKey }));

/** Valider des propositions ; une proposition devenue impossible est signalée et ignorée. */
export const approveProposals = async (
  assignmentIds: string[],
  idempotencyKey: string,
): Promise<AssignmentBatch> =>
  parseResponse(
    assignmentBatchSchema,
    await api.post(path('planning', 'proposals', 'approve'), { assignmentIds }, { idempotencyKey }),
  );
