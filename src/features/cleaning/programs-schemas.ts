import * as z from 'zod/mini';
import {
  arrivalCheckSchema,
  assignedAgentSchema,
  CUSTOMER_KINDS,
  photoSchema,
  placeSummarySchema,
  schedulePlanSchema,
  typeRefSchema,
} from './requests-schemas';
import { hiddenMoney, moneySchema, page } from './schemas';

/*
 * Programmes et séances du Nettoyage v2 (sous-lot 1c-3), champ par champ d'après le contrat
 * `ksp-api.v1.yaml` (schémas `CleaningProgram*`, `CleaningSession*`). Mêmes règles que `schemas.ts` :
 * champ obligatoire absent = réponse invalide, champ ajouté ignoré, montants facultatifs (absents sans
 * `cleaning.amounts.read`).
 */

export const PROGRAM_STATUSES = ['confirmed', 'in_progress', 'suspended', 'completed', 'cancelled'] as const;
export const PROGRAM_SORTS = ['-createdAt', 'createdAt'] as const;
export const SESSION_STATUSES = [
  'to_assign',
  'assigned',
  'in_progress',
  'interrupted',
  'completed',
  'missed',
  'suspended',
  'cancelled',
] as const;
export const PAYMENT_STATUSES = ['not_due', 'due', 'paid', 'overdue', 'waived'] as const;
export const SUSPENSION_CAUSES = [
  'overdue_sessions',
  'unpaid_invoices',
  'ksp_decision',
  'organization_suspended',
] as const;
export const SESSION_CANCEL_CAUSES = [
  'customer',
  'customer_late',
  'ksp',
  'no_agent',
  'program_stopped',
] as const;
export const INCIDENT_CATEGORIES = [
  'equipment',
  'access',
  'safety',
  'out_of_scope_request',
  'other',
] as const;

/** `CleaningSuspensionCause` : causes cumulables (R-SU-01). */
const suspensionCauseSchema = z.object({
  cause: z.enum(SUSPENSION_CAUSES),
  since: z.string(),
  reason: z.nullable(z.string()),
});

/** `CleaningRenewal` : renouvellement proposé (R-PG-07). */
const renewalSchema = z.object({
  status: z.enum(['proposed', 'accepted', 'declined']),
  proposedAt: z.string(),
  quoteId: z.nullable(z.string()),
  visitRequired: z.boolean(),
});

/** `CleaningProgramCancellationRequest` : arrêt demandé, en attente d'une deuxième personne. */
const cancellationRequestSchema = z.object({
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
});

/** `CleaningProgram` : programme né d'un devis accepté (partie 8). */
export const programSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(PROGRAM_STATUSES),
  requestId: z.string(),
  quoteId: z.string(),
  customerKind: z.enum(CUSTOMER_KINDS),
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  payerKind: z.enum(CUSTOMER_KINDS),
  place: placeSummarySchema,
  cleaningTypes: z.array(typeRefSchema),
  schedule: schedulePlanSchema,
  sessionsCount: z.int(),
  sessionsCompleted: z.int(),
  sessionPrice: z.optional(moneySchema),
  total: z.optional(moneySchema),
  firstSessionAt: z.nullable(z.string()),
  lastSessionAt: z.nullable(z.string()),
  suspensionCauses: z.array(suspensionCauseSchema),
  renewal: z.nullable(renewalSchema),
  createdAt: z.string(),
  pendingCancellation: z.nullable(cancellationRequestSchema),
  customerName: z.nullable(z.string()),
  organizationName: z.nullable(z.string()),
});
export const programListSchema = page(programSchema);

/** `CleaningCatchUpProposal` : séance à rattraper après une suspension (R-SU-03). */
const catchUpSchema = z.object({
  sessionId: z.string(),
  rank: z.int(),
  previousStart: z.string(),
  suggestedStart: z.nullable(z.string()),
});

/** `CleaningProgramResumption` : programme repris et séances à rattraper. */
export const programResumptionSchema = z.object({ program: programSchema, catchUp: z.array(catchUpSchema) });

/** `CleaningChecklistItem`. */
const sessionChecklistItemSchema = z.object({
  code: z.string(),
  label: z.string(),
  cleaningTypeCode: z.nullable(z.string()),
  checked: z.boolean(),
  checkedAt: z.nullable(z.string()),
});

/** `CleaningIncident` : incident sur place (partie 10). */
const incidentSchema = z.object({
  id: z.string(),
  category: z.enum(INCIDENT_CATEGORIES),
  note: z.string(),
  photos: z.array(photoSchema),
  reportedAt: z.string(),
  decision: z.enum(['pending', 'resumed', 'rescheduled', 'cancelled']),
  decidedAt: z.nullable(z.string()),
});

/** `CleaningRating` : note du client. */
const ratingSchema = z.object({ stars: z.int(), comment: z.nullable(z.string()), ratedAt: z.string() });

/** `CleaningReschedule` : ancienne date d'une séance reportée. */
const rescheduleSchema = z.object({
  previousStart: z.string(),
  newStart: z.string(),
  by: z.enum(['customer', 'ksp']),
  at: z.string(),
  reason: z.nullable(z.string()),
  actorId: z.nullable(z.string()),
});

/** `CleaningSessionCancellation` : annulation d'une séance (partie 12). */
const sessionCancellationSchema = z.object({
  by: z.enum(['customer', 'ksp']),
  late: z.boolean(),
  at: z.string(),
  cause: z.enum(SESSION_CANCEL_CAUSES),
  reason: z.nullable(z.string()),
  actorId: z.nullable(z.string()),
});

/** `CleaningSession` : séance d'un programme (parties 8 et 10). */
export const sessionSchema = z.object({
  id: z.string(),
  programId: z.string(),
  programNumber: z.string(),
  rank: z.int(),
  sessionsCount: z.int(),
  status: z.enum(SESSION_STATUSES),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  /** Particulier seulement ; `null` pour une entreprise (facture mensuelle). */
  paymentStatus: z.nullable(z.enum(PAYMENT_STATUSES)),
  price: z.optional(moneySchema),
  amountDue: hiddenMoney,
  visitFeeDeduction: hiddenMoney,
  dueBy: z.nullable(z.string()),
  agents: z.array(assignedAgentSchema),
  arrival: z.nullable(arrivalCheckSchema),
  startedAt: z.nullable(z.string()),
  completedAt: z.nullable(z.string()),
  checklist: z.array(sessionChecklistItemSchema),
  photos: z.array(photoSchema),
  incidents: z.array(incidentSchema),
  signed: z.boolean(),
  rating: z.nullable(ratingSchema),
  reschedules: z.array(rescheduleSchema),
  cancellation: z.nullable(sessionCancellationSchema),
  isRedo: z.boolean(),
  invoiceId: z.nullable(z.string()),
  claimIds: z.array(z.string()),
  customerName: z.nullable(z.string()),
  organizationName: z.nullable(z.string()),
});
export const sessionListSchema = page(sessionSchema);

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export type ProgramSort = (typeof PROGRAM_SORTS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type SuspensionCause = (typeof SUSPENSION_CAUSES)[number];
export type SessionCancelCause = (typeof SESSION_CANCEL_CAUSES)[number];
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type Program = z.infer<typeof programSchema>;
export type ProgramResumption = z.infer<typeof programResumptionSchema>;
export type CatchUp = z.infer<typeof catchUpSchema>;
export type CleaningSession = z.infer<typeof sessionSchema>;
export type SessionIncident = z.infer<typeof incidentSchema>;
