import * as z from 'zod/mini';
import { hiddenMoney, moneySchema, page, pricingSchema } from './schemas';

/*
 * Dossiers, visites et devis du Nettoyage v2 (sous-lot 1b), champ par champ d'après le contrat
 * `ksp-api.v1.yaml` (schémas `CleaningRequest*`, `CleaningVisit*`, `CleaningQuote*`). Mêmes règles que
 * `schemas.ts` : champ obligatoire absent = réponse invalide, champ ajouté ignoré, montants facultatifs
 * (masqués sans `cleaning.amounts.read`).
 */

export const REQUEST_STATUSES = [
  'awaiting_visit_fee',
  'visit_to_schedule',
  'visit_scheduled',
  'visit_missed',
  'visit_done',
  'quote_sent',
  'accepted',
  'declined',
  'expired',
  'cancelled',
  'rejected',
] as const;
export const CUSTOMER_KINDS = ['individual', 'organization'] as const;
export const REQUEST_SORTS = ['-createdAt', 'createdAt', 'nextVisitAt'] as const;
export const VISIT_STATUSES = ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled'] as const;
export const VISIT_SORTS = ['scheduledAt', '-scheduledAt'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** `CleaningScalar` : nombre entier, code de choix ou oui/non. */
export const scalarSchema = z.union([z.int(), z.string(), z.boolean()]);
/** `CleaningValues` : code du paramètre → valeur. */
export const valuesSchema = z.record(z.string(), scalarSchema);

/** `TimeSlot` : début inclus, fin exclue. */
export const timeSlotSchema = z.object({ start: z.string(), end: z.string() });

/** `CleaningTypeRef` : type de nettoyage d'un dossier (nom en vigueur). */
export const typeRefSchema = z.object({ id: z.string(), code: z.string(), name: z.string() });

/** `CleaningPlaceLocation` : position et repère (données personnelles). */
const placeLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  landmark: z.string(),
  address: z.nullable(z.string()),
  readableAddress: z.nullable(z.string()),
  accuracyMeters: z.nullable(z.int()),
});

/** `CleaningPlaceSummary` : lieu d'un dossier ; `location` nulle pour qui n'a pas à la voir. */
const placeSummarySchema = z.object({
  placeId: z.string(),
  name: z.string(),
  placeTypeId: z.string(),
  placeTypeName: z.string(),
  communeKey: z.string(),
  communeName: z.string(),
  location: z.nullable(placeLocationSchema),
});

/** `CleaningPhoto` : lien temporaire, nul si la photo n'est plus conservée. */
export const photoSchema = z.object({
  fileId: z.string(),
  kind: z.enum(['request', 'visit', 'absence', 'before', 'after', 'incident', 'claim']),
  takenAt: z.string(),
  url: z.nullable(z.string()),
  urlExpiresAt: z.nullable(z.string()),
});

/** `CleaningMonthWeekday`. */
const monthWeekdaySchema = z.object({
  rank: z.enum(['first', 'second', 'third', 'fourth', 'last']),
  weekday: z.enum(WEEKDAYS),
});

/** `CleaningSchedulePlan` : programme souhaité (partie 8). */
export const schedulePlanSchema = z.object({
  kind: z.enum(['one_off', 'weekly', 'monthly']),
  startTime: z.string(),
  dates: z.optional(z.array(z.string())),
  weekdays: z.optional(z.array(z.enum(WEEKDAYS))),
  everyWeeks: z.optional(z.int()),
  monthDays: z.optional(z.array(z.int())),
  monthWeekdays: z.optional(z.array(monthWeekdaySchema)),
  startDate: z.optional(z.string()),
  endDate: z.optional(z.string()),
  durationWeeks: z.optional(z.int()),
  durationMonths: z.optional(z.int()),
  excludedDates: z.optional(z.array(z.string())),
  addedDates: z.optional(z.array(z.string())),
  excludeHolidays: z.optional(z.boolean()),
});

/** `CleaningVisitFee` : frais de visite (partie 7.2). */
export const visitFeeSchema = z.object({
  id: z.string(),
  rank: z.int(),
  amount: z.optional(moneySchema),
  status: z.enum(['awaiting_payment', 'paid', 'refunded', 'retained', 'deducted']),
  payBefore: z.nullable(z.string()),
  paidAt: z.nullable(z.string()),
  invoiceId: z.nullable(z.string()),
  refundedAt: z.nullable(z.string()),
});

/** `CleaningAssignedAgent`. */
const assignedAgentSchema = z.object({
  agentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: z.nullable(z.string()),
  isLead: z.boolean(),
  confirmation: z.enum(['confirmed', 'pending', 'proposed']),
});

/** `CleaningArrivalCheck` : arrivée comparée à la position du lieu. */
const arrivalCheckSchema = z.object({
  arrivedAt: z.string(),
  distanceMeters: z.nullable(z.int()),
  alert: z.boolean(),
  placeAccuracyMeters: z.nullable(z.int()),
  arrivalAccuracyMeters: z.nullable(z.int()),
  uncertain: z.boolean(),
});

/** `CleaningVisit` : visite des lieux (partie 7.3). */
export const visitSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  requestNumber: z.string(),
  status: z.enum(VISIT_STATUSES),
  scheduledAt: z.string(),
  durationMinutes: z.int(),
  travelMinutes: z.nullable(z.int()),
  agents: z.array(assignedAgentSchema),
  arrival: z.nullable(arrivalCheckSchema),
  observedValues: z.nullable(valuesSchema),
  photos: z.array(photoSchema),
  completedAt: z.nullable(z.string()),
  missedAt: z.nullable(z.string()),
  cancelledAt: z.nullable(z.string()),
  cancelCause: z.nullable(
    z.enum(['request_cancelled', 'request_rejected', 'slot_changed', 'ksp', 'agent_no_show']),
  ),
  note: z.nullable(z.string()),
});
export const visitListSchema = page(visitSchema);

/** `CleaningComparisonRow` : écart d'un paramètre (R-CS-02). */
const comparisonRowSchema = z.object({
  parameterCode: z.string(),
  label: z.string(),
  unit: z.nullable(z.string()),
  declared: z.nullable(scalarSchema),
  observed: z.nullable(scalarSchema),
  retained: z.nullable(scalarSchema),
  priceEffect: hiddenMoney,
  reason: z.nullable(z.string()),
  declaredDisplay: z.nullable(z.string()),
  observedDisplay: z.nullable(z.string()),
  retainedDisplay: z.nullable(z.string()),
});

/** `CleaningComparison` : déclaré, constaté, retenu (partie 7.4). */
export const comparisonSchema = z.object({
  confirmed: z.boolean(),
  rows: z.array(comparisonRowSchema),
  addedCleaningTypes: z.array(typeRefSchema),
  removedCleaningTypes: z.array(typeRefSchema),
  declaredSessionPrice: hiddenMoney,
  retainedSessionPrice: hiddenMoney,
});

/** `CleaningValueRow` : ligne figée d'une réponse, dans l'ordre du formulaire. */
const valueRowSchema = z.object({
  code: z.string(),
  label: z.string(),
  kind: z.enum(['number', 'choice', 'boolean']),
  unit: z.nullable(z.string()),
  value: z.nullable(scalarSchema),
  display: z.string(),
  choiceLabel: z.nullable(z.string()),
});

/** `CleaningValueReason` : motif d'un écart avec le constat (paramètre, ou type ajouté/retiré). */
export const valueReasonSchema = z.object({
  parameterCode: z.nullable(z.string()),
  cleaningTypeId: z.nullable(z.string()),
  reason: z.string(),
});

/** `CleaningRetainedValues` : version retenue par la supervision (partie 7.4). */
export const retainedValuesSchema = z.object({
  values: valuesSchema,
  cleaningTypes: z.array(typeRefSchema),
  reasons: z.array(valueReasonSchema),
  pricing: pricingSchema,
  authorId: z.string(),
  updatedAt: z.string(),
  locked: z.boolean(),
  revision: z.int(),
  reason: z.nullable(z.string()),
});

/** `CleaningQuoteLine` : ligne de devis par type (R-DV-01). */
const quoteLineSchema = z.object({
  offerId: z.string(),
  cleaningTypeId: z.string(),
  name: z.string(),
  quantity: z.int(),
  unit: z.nullable(z.string()),
  unitPrice: z.optional(moneySchema),
  amount: z.optional(moneySchema),
  kind: z.enum(['offer', 'pack_discount']),
});

/** `CleaningQuoteAdjustment` : remise ou majoration manuelle (R-DV-03). */
export const quoteAdjustmentSchema = z.object({
  kind: z.enum(['discount', 'surcharge']),
  percentBps: z.nullable(z.int()),
  fixedAmount: hiddenMoney,
  amount: z.optional(moneySchema),
  reason: z.string(),
  approvalStatus: z.enum(['not_required', 'pending', 'approved']),
  approvedBy: z.nullable(z.string()),
});

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'superseded',
  'withdrawn',
] as const;

/** `CleaningQuote` : devis (partie 7.5). */
export const quoteSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  requestNumber: z.string(),
  programId: z.nullable(z.string()),
  kind: z.enum(['initial', 'amendment', 'renewal', 'reorder']),
  version: z.int(),
  status: z.enum(QUOTE_STATUSES),
  place: placeSummarySchema,
  lines: z.array(quoteLineSchema),
  adjustments: z.array(quoteAdjustmentSchema),
  sessionPrice: z.optional(moneySchema),
  sessionsCount: z.int(),
  sessionStarts: z.array(z.string()),
  total: z.optional(moneySchema),
  visitFeeDeduction: z.optional(moneySchema),
  teamSize: z.int(),
  durationMinutes: z.int(),
  schedule: schedulePlanSchema,
  paymentTerms: z.enum(['per_session', 'monthly_invoice']),
  comparison: z.nullable(comparisonSchema),
  validUntil: z.nullable(z.string()),
  termsVersion: z.string(),
  pdfDocumentId: z.nullable(z.string()),
  sentAt: z.nullable(z.string()),
  respondedAt: z.nullable(z.string()),
  createdAt: z.string(),
  retainedRevision: z.nullable(z.int()),
});

/** `CleaningReactivation` : demande de réactivation d'un devis expiré (R-AC-04). */
const reactivationSchema = z.object({
  requestedAt: z.string(),
  status: z.enum(['pending', 'accepted', 'refused']),
  decidedAt: z.nullable(z.string()),
});

const requestCommon = {
  id: z.string(),
  number: z.string(),
  status: z.enum(REQUEST_STATUSES),
  customerKind: z.enum(CUSTOMER_KINDS),
  customerId: z.string(),
  organizationId: z.nullable(z.string()),
  cleaningTypes: z.array(typeRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Remplis pour le personnel seulement. */
  customerName: z.nullable(z.string()),
  organizationName: z.nullable(z.string()),
};

/** `CleaningRequestSummary` : dossier, élément de la file. */
export const requestSummarySchema = z.object({
  ...requestCommon,
  placeTypeName: z.string(),
  communeKey: z.string(),
  communeName: z.string(),
  nextVisitAt: z.nullable(z.string()),
});
export const requestSummaryListSchema = page(requestSummarySchema);

/** `CleaningRequest` : fiche dossier (« un dossier = un lieu »). */
export const requestSchema = z.object({
  ...requestCommon,
  place: placeSummarySchema,
  declaredValues: valuesSchema,
  freeDescription: z.nullable(z.string()),
  comment: z.nullable(z.string()),
  photos: z.array(photoSchema),
  schedule: schedulePlanSchema,
  visitSlots: z.array(timeSlotSchema),
  declaredPricing: pricingSchema,
  visitFee: visitFeeSchema,
  visits: z.array(visitSchema),
  retained: z.nullable(retainedValuesSchema),
  comparison: z.nullable(comparisonSchema),
  currentQuote: z.nullable(quoteSchema),
  quoteHistory: z.array(quoteSchema),
  programId: z.nullable(z.string()),
  reactivation: z.nullable(reactivationSchema),
  declaredRows: z.array(valueRowSchema),
  visitFees: z.array(visitFeeSchema),
  warnings: z.array(z.enum(['organization_unpaid_invoices'])),
});

/** `CleaningLocationCorrection` : résultat d'une correction de position, sans montant. */
export const locationCorrectionSchema = z.object({
  requestId: z.string(),
  communeKey: z.string(),
  communeName: z.string(),
  communeChanged: z.boolean(),
  placeUpdated: z.boolean(),
  correctedAt: z.string(),
});

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];
export type RequestSort = (typeof REQUEST_SORTS)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type VisitSort = (typeof VISIT_SORTS)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type Scalar = z.infer<typeof scalarSchema>;
export type CleaningValues = z.infer<typeof valuesSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type SchedulePlanValue = z.infer<typeof schedulePlanSchema>;
export type VisitFee = z.infer<typeof visitFeeSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type RetainedValues = z.infer<typeof retainedValuesSchema>;
export type ValueReason = z.infer<typeof valueReasonSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteAdjustment = z.infer<typeof quoteAdjustmentSchema>;
export type RequestSummary = z.infer<typeof requestSummarySchema>;
export type CleaningRequest = z.infer<typeof requestSchema>;
export type LocationCorrection = z.infer<typeof locationCorrectionSchema>;
