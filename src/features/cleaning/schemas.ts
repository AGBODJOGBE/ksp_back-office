import * as z from 'zod/mini';

/*
 * Réponses de la gateway pour le Nettoyage du back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/cleaning/*`). Champ par champ selon le contrat : un champ obligatoire absent rend la
 * réponse invalide ; un champ ajouté par la gateway est ignoré. Les énumérations restent des chaînes
 * pour qu'un nouvel état ne casse pas l'écran (il s'affiche avec un libellé neutre).
 * Schémas lus dans le navigateur : `zod/mini`, comme le portail.
 */

/** `Money` : entiers de FCFA. */
export const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });

export const timeSlotSchema = z.object({ start: z.string(), end: z.string() });

/**
 * Nom affiché lu dans identity par le service cleaning (ADR-029) : facultatif dans le contrat, `null`
 * quand il est inconnu ou qu'identity ne répond pas. L'écran retombe alors sur un libellé court.
 */
const displayName = z.optional(z.nullable(z.string()));

const priceLineSchema = z.object({
  label: z.string(),
  quantity: z.int(),
  unitPrice: moneySchema,
  amount: moneySchema,
});

const priceRangeSchema = z.object({ low: moneySchema, high: moneySchema });

/** `CleaningRecurrence` : passages par semaine ou par mois, pendant une durée en mois. */
const recurrenceSchema = z.object({ period: z.string(), visitsPerPeriod: z.int(), durationMonths: z.int() });

/** `CleaningSiteVisit` : visite des lieux, obligatoire avant tout devis. */
const siteVisitSchema = z.object({
  id: z.string(),
  status: z.string(),
  scheduledAt: z.string(),
  agentId: z.string(),
  report: z.nullable(z.string()),
  completedAt: z.nullable(z.string()),
  agentName: displayName,
});

/** `CleaningQuote` : devis envoyé, prix figé à l'envoi. */
const quoteSchema = z.object({
  id: z.string(),
  lines: z.array(priceLineSchema),
  subtotal: moneySchema,
  interventionCount: z.int(),
  total: moneySchema,
  proposedSlots: z.array(timeSlotSchema),
  validUntil: z.string(),
  depositPercent: z.int(),
  depositAmount: moneySchema,
  recurrence: z.nullable(recurrenceSchema),
  teamSize: z.int(),
  durationMinutes: z.int(),
  sentAt: z.string(),
});

/** `CleaningQuoteRequest`. */
export const quoteRequestSchema = z.object({
  id: z.string(),
  status: z.string(),
  customerId: z.string(),
  customerKind: z.string(),
  organizationId: z.nullable(z.string()),
  serviceCode: z.string(),
  premisesType: z.string(),
  quantity: z.int(),
  options: z.array(z.string()),
  commune: z.string(),
  address: z.string(),
  preferredSlots: z.array(timeSlotSchema),
  comment: z.nullable(z.string()),
  recurrence: z.nullable(recurrenceSchema),
  requestedTeamSize: z.nullable(z.int()),
  daysPerWeek: z.nullable(z.int()),
  recommendedTeamSize: z.int(),
  estimate: z.nullable(priceRangeSchema),
  visit: z.nullable(siteVisitSchema),
  quote: z.nullable(quoteSchema),
  missionId: z.nullable(z.string()),
  closingReason: z.nullable(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  customerName: displayName,
  organizationName: displayName,
});

export const quoteRequestListSchema = z.object({
  data: z.array(quoteRequestSchema),
  nextCursor: z.nullable(z.string()),
});

const agentRefSchema = z.object({ agentId: z.string(), displayName: z.string() });

/** `CleaningIntervention` : un passage de la mission. */
const interventionSchema = z.object({
  id: z.string(),
  status: z.string(),
  scheduledStart: z.string(),
  durationMinutes: z.int(),
  agents: z.array(agentRefSchema),
  checklist: z.array(z.object({ code: z.string(), label: z.string(), done: z.boolean() })),
  incidentNote: z.nullable(z.string()),
  /** Références du service file : aucune route de la gateway ne permet encore de les lire ni d'en envoyer. */
  beforePhotoFileIds: z.array(z.string()),
  afterPhotoFileIds: z.array(z.string()),
  startedAt: z.nullable(z.string()),
  completedAt: z.nullable(z.string()),
  cancellationCause: z.nullable(z.string()),
});

/**
 * `CleaningSuspension` (ADR-030) : causes cumulées, la plus ancienne d'abord (`cause` reste la plus
 * ancienne). `unpaidCount` peut valoir 0 pour une organisation suspendue par KSP.
 */
const suspensionSchema = z.object({
  cause: z.string(),
  causes: z.array(z.string()),
  since: z.string(),
  unpaidCount: z.int(),
});

const paymentStateSchema = z.object({
  plan: z.object({ option: z.string(), timing: z.string(), method: z.string() }),
  status: z.string(),
  total: moneySchema,
  depositPercent: z.int(),
  depositAmount: moneySchema,
  paid: moneySchema,
  payments: z.array(
    z.object({
      id: z.string(),
      amount: moneySchema,
      method: z.string(),
      reference: z.nullable(z.string()),
      recordedBy: z.string(),
      recordedByName: displayName,
      recordedAt: z.string(),
    }),
  ),
});

/** `CleaningMission`. */
export const missionSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  quoteId: z.string(),
  customerId: z.string(),
  /** Particulier ou entreprise (ajout ADR-029) : une mission d'entreprise se règle par sa facture. */
  customerKind: z.optional(z.string()),
  organizationId: z.optional(z.nullable(z.string())),
  customerName: displayName,
  organizationName: displayName,
  status: z.string(),
  serviceCode: z.string(),
  commune: z.string(),
  address: z.string(),
  chosenSlot: timeSlotSchema,
  recurrence: z.nullable(recurrenceSchema),
  plannedInterventions: z.int(),
  completedInterventions: z.int(),
  interventions: z.array(interventionSchema),
  payment: paymentStateSchema,
  cancellationReason: z.nullable(z.string()),
  daysPerWeek: z.nullable(z.int()),
  suspension: z.nullable(suspensionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const missionListSchema = z.object({
  data: z.array(missionSchema),
  nextCursor: z.nullable(z.string()),
});

const optionSchema = z.object({ code: z.string(), label: z.string(), price: z.nullable(moneySchema) });

/** `CleaningPricing` : grille en vigueur d'une prestation (version datée, auteur). */
const pricingSchema = z.object({
  version: z.int(),
  unitPrice: z.nullable(moneySchema),
  minimumPrice: z.nullable(moneySchema),
  options: z.array(optionSchema),
  communeCoefficients: z.array(z.object({ commune: z.string(), coefficientBp: z.int() })),
  defaultCoefficientBp: z.int(),
  teamSize: z.object({ unitsPerAgent: z.int(), minAgents: z.int(), maxAgents: z.int() }),
  checklist: z.array(z.object({ code: z.string(), label: z.string() })),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

/** `CleaningServiceDefinition`. */
export const serviceDefinitionSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  unit: z.string(),
  active: z.boolean(),
  pricing: pricingSchema,
});

/** `CleaningSettings`. */
export const settingsSchema = z.object({
  quoteValidityDays: z.int(),
  minimumLeadHours: z.int(),
  freeCancellationHours: z.int(),
  visitThresholdSquareMeters: z.int(),
  maxOpenRequests: z.int(),
  depositPercent: z.int(),
  businessWarningUnpaidInvoices: z.int(),
  businessSuspensionUnpaidInvoices: z.int(),
  individualSuspensionUnpaidInterventions: z.int(),
  individualPaymentGraceHours: z.int(),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

export const catalogSchema = z.object({
  services: z.array(serviceDefinitionSchema),
  settings: settingsSchema,
});

/** `CleaningZone`. */
export const zoneSchema = z.object({
  code: z.string(),
  commune: z.string(),
  active: z.boolean(),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

export const zoneListSchema = z.object({ data: z.array(zoneSchema) });

/** `CleaningAgent`. */
export const agentSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  active: z.boolean(),
  unavailabilities: z.array(
    z.object({ id: z.string(), start: z.string(), end: z.string(), reason: z.nullable(z.string()) }),
  ),
});

export const agentListSchema = z.object({ data: z.array(agentSchema) });

/** `CleaningTeam`. */
export const teamSchema = z.object({ id: z.string(), name: z.string(), members: z.array(agentRefSchema) });

export const teamListSchema = z.object({ data: z.array(teamSchema) });

/** `CleaningServedZoneList` (route publique) : zones actives, code et nom affiché. */
export const servedZoneListSchema = z.object({
  data: z.array(z.object({ code: z.string(), commune: z.string() })),
});

/** `CleaningServiceList` (route publique) : seuls le code et le nom servent au back-office. */
export const serviceNamesSchema = z.object({
  data: z.array(z.object({ code: z.string(), name: z.string() })),
});

export type Money = z.infer<typeof moneySchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteRequestList = z.infer<typeof quoteRequestListSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type MissionList = z.infer<typeof missionListSchema>;
export type Suspension = z.infer<typeof suspensionSchema>;
export type Intervention = z.infer<typeof interventionSchema>;
export type ServiceDefinition = z.infer<typeof serviceDefinitionSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type Team = z.infer<typeof teamSchema>;
