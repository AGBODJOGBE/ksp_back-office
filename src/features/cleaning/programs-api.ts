import type * as z from 'zod/mini';
import { api, parseResponse } from '@/lib/api';
import { type AmountInput, listPage, path, read, type Values } from './api';
import type { AdjustmentInput } from './requests-api';
import { type CustomerKind, type Quote, quoteSchema, type SchedulePlanValue } from './requests-schemas';
import {
  type CleaningSession,
  type PaymentStatus,
  type Program,
  type ProgramResumption,
  programListSchema,
  programResumptionSchema,
  programSchema,
  type ProgramSort,
  type ProgramStatus,
  sessionListSchema,
  sessionSchema,
  type SessionStatus,
} from './programs-schemas';

/**
 * Appels du Nettoyage v2, sous-lot 1c-3 : programmes et séances (`/api/v1/admin/cleaning/{programs,
 * sessions}`). Chaque réponse est validée par son schéma. Toutes les décisions portent la clé
 * d'idempotence exigée par le contrat, tirée par l'écran à l'ouverture de la boîte ou du formulaire et
 * renvoyée telle quelle à chaque nouvel essai.
 */

async function send<S extends z.ZodMiniType>(
  schema: S,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api.post(url, body, { idempotencyKey }));
}

// --- Programmes ----------------------------------------------------------------------------------

/** Filtres de `GET /programs` (tous facultatifs). */
export interface ProgramFilters {
  status?: ProgramStatus;
  communeKey?: string;
  payerKind?: CustomerKind;
  /** Numéro de programme (50 caractères au plus). */
  q?: string;
  customerId?: string;
  organizationId?: string;
  sort?: ProgramSort;
}

export const listPrograms = (filters: ProgramFilters = {}) =>
  listPage(programListSchema, path('programs'), { ...filters });
/** Nombre de programmes d'un statut (`total`), lu sur une page d'un élément. */
export const countPrograms = async (filters: ProgramFilters): Promise<number> =>
  (await read(programListSchema, path('programs'), { ...filters, limit: 1 })).total;
export const getProgram = (id: string): Promise<Program> => read(programSchema, path('programs', id));

/** Filtres de `GET /programs/{id}/sessions` : statut de séance et de paiement. */
export interface SessionFilters {
  status?: SessionStatus;
  paymentStatus?: PaymentStatus;
}

/** Échéancier : séances et paiements, dans l'ordre chronologique. */
export const listProgramSessions = (programId: string, filters: SessionFilters = {}) =>
  listPage(sessionListSchema, path('programs', programId, 'sessions'), {
    ...filters,
    sort: 'scheduledStart',
  });

/** `CleaningChangeProgramScheduleBody` : nouveau plan des séances à partir d'une date, motif. */
export interface ScheduleChangeBody {
  effectiveFrom: string;
  schedule: SchedulePlanValue;
  reason: string;
  durationMinutes?: number;
}

export const changeProgramSchedule = (id: string, body: ScheduleChangeBody, key: string): Promise<Program> =>
  send(programSchema, path('programs', id, 'schedule-change'), body, key);

/** `CleaningCreateAmendmentBody` : tout facultatif (champ absent = valeur proposée par le calcul). */
export interface AmendmentBody {
  addCleaningTypeIds?: string[];
  addSchedule?: SchedulePlanValue;
  values?: Values;
  teamSize?: number;
  durationMinutes?: number;
  adjustments?: AdjustmentInput[];
  onQuotePrices?: { offerId: string; price: AmountInput }[];
  validityDays?: number;
}

/** Avenant : devis complémentaire en brouillon (`kind: amendment`), envoyé puis accepté comme un devis. */
export const createAmendment = (id: string, body: AmendmentBody, key: string): Promise<Quote> =>
  send(quoteSchema, path('programs', id, 'amendments'), body, key);

export const suspendProgram = (id: string, reason: string, key: string): Promise<Program> =>
  send(programSchema, path('programs', id, 'suspend'), { reason }, key);

/** Lève la décision de KSP ; renvoie le programme et les séances à rattraper (R-SU-03). */
export const resumeProgram = (id: string, reason: string, key: string): Promise<ProgramResumption> =>
  send(programResumptionSchema, path('programs', id, 'resume'), reason ? { reason } : {}, key);

/** Demande d'arrêt : sans effet avant la validation d'une deuxième personne. */
export const requestProgramCancellation = (id: string, reason: string, key: string): Promise<Program> =>
  send(programSchema, path('programs', id, 'cancel'), { reason }, key);

export const approveProgramCancellation = (id: string, key: string): Promise<Program> =>
  send(programSchema, path('programs', id, 'cancel', 'approve'), undefined, key);

// --- Séances -------------------------------------------------------------------------------------

export const getSession = (id: string): Promise<CleaningSession> => read(sessionSchema, path('sessions', id));

/** `CleaningRescheduleSessionAsKspBody`. */
export interface RescheduleBody {
  newStart: string;
  reason: string;
  durationMinutes?: number;
}

export const rescheduleSession = (id: string, body: RescheduleBody, key: string): Promise<CleaningSession> =>
  send(sessionSchema, path('sessions', id, 'reschedule'), body, key);

/** `ksp` : rien à payer ; `customer_late` : annulation tardive du client, 50 % dus. */
export type SessionCancelInitiator = 'ksp' | 'customer_late';

export const cancelSession = (
  id: string,
  body: { initiatedBy: SessionCancelInitiator; reason: string },
  key: string,
): Promise<CleaningSession> => send(sessionSchema, path('sessions', id, 'cancel'), body, key);

export const resumeSession = (id: string, reason: string, key: string): Promise<CleaningSession> =>
  send(sessionSchema, path('sessions', id, 'resume'), reason ? { reason } : {}, key);

/** `CleaningCompleteSessionAsKspBody` : clôture pour l'équipe (R-EX-08). */
export interface CompleteSessionBody {
  reason: string;
  startedAt: string;
  completedAt: string;
  presentAgentIds: string[];
}

export const completeSession = (
  id: string,
  body: CompleteSessionBody,
  key: string,
): Promise<CleaningSession> => send(sessionSchema, path('sessions', id, 'complete'), body, key);

/** `CleaningReportSessionMissedAsKspBody` : client absent ou accès impossible (R-EX-08). */
export interface MissedSessionBody {
  reason: string;
  cause: 'customer_absent' | 'access_impossible';
  missedAt: string;
  presentAgentIds: string[];
}

export const reportSessionMissed = (
  id: string,
  body: MissedSessionBody,
  key: string,
): Promise<CleaningSession> => send(sessionSchema, path('sessions', id, 'missed'), body, key);

export const removeSessionPhoto = (
  id: string,
  fileId: string,
  reason: string,
  key: string,
): Promise<CleaningSession> =>
  send(sessionSchema, path('sessions', id, 'photos', fileId, 'remove'), { reason }, key);
