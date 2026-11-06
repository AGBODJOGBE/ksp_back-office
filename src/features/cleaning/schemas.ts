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
  /** Visite commune à plusieurs demandes du groupe (ADR-035) ; null pour une visite propre à la demande. */
  groupVisitId: z.optional(z.nullable(z.string())),
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

/** `Money` ou `null`. */
const optionalMoney = z.nullable(moneySchema);

/** `CleaningAnswers` : réponses au formulaire par code de champ (entier, code d'une valeur, oui/non). */
const answersSchema = z.record(z.string(), z.union([z.int(), z.string(), z.boolean()]));

/** `CleaningCalculationLine`. */
const calculationLineSchema = z.object({
  kind: z.string(),
  optionCode: z.nullable(z.string()),
  fieldCode: z.nullable(z.string()),
  choiceCode: z.nullable(z.string()),
  label: z.string(),
  quantity: z.int(),
  unitLabel: z.nullable(z.string()),
  unitPrice: moneySchema,
  amount: moneySchema,
});

/** `CleaningPriceCalculation` (ADR-033) : détail du calcul fait par le serveur au moment de la demande. */
const calculationSchema = z.object({
  pricingVersion: z.nullable(z.int()),
  priced: z.boolean(),
  reason: z.nullable(z.string()),
  missingPrices: z.array(
    z.object({
      optionCode: z.nullable(z.string()),
      fieldCode: z.nullable(z.string()),
      choiceCode: z.nullable(z.string()),
    }),
  ),
  lines: z.array(calculationLineSchema),
  baseAmount: optionalMoney,
  coefficients: z.array(
    z.object({
      source: z.string(),
      optionCode: z.nullable(z.string()),
      fieldCode: z.nullable(z.string()),
      code: z.nullable(z.string()),
      label: z.string(),
      coefficientBp: z.int(),
    }),
  ),
  subtotal: optionalMoney,
  minimumPrice: optionalMoney,
  minimumApplied: z.boolean(),
  computedPrice: optionalMoney,
  estimate: z.nullable(priceRangeSchema),
  recommendedTeamSize: z.int(),
});

/** `CleaningAnswerSummaryField` (ADR-037) : réponse lisible, valeur affichable déjà mise en forme par cleaning. */
const answerSummaryFieldSchema = z.object({
  code: z.string(),
  label: z.string(),
  type: z.string(),
  value: z.union([z.int(), z.string(), z.boolean()]),
  display: z.string(),
  unitLabel: z.nullable(z.string()),
});

/**
 * `CleaningAnswerSummary` (ADR-037) : réponses lisibles d'une demande, sans prix. Une demande à l'ancien format
 * donne « Type de locaux » et « Quantité ».
 */
export const answerSummarySchema = z.object({
  fields: z.array(answerSummaryFieldSchema),
  options: z.array(
    z.object({ optionCode: z.string(), label: z.string(), fields: z.array(answerSummaryFieldSchema) }),
  ),
  frequency: z.nullable(z.object({ code: z.string(), label: z.string() })),
});

/** `CleaningOptionSelection` : option choisie et ses réponses. */
const optionSelectionSchema = z.object({ code: z.string(), answers: answersSchema });

/** `CleaningGeoLocation` : position GPS (degrés décimaux WGS 84), précision en mètres ou `null`. */
const geoLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.nullable(z.number()),
});

/** `CleaningGroupedRequest` : autre demande du même groupe (détail d'une demande seulement). */
const groupedRequestSchema = z.object({
  id: z.string(),
  serviceCode: z.string(),
  serviceName: z.nullable(z.string()),
  status: z.string(),
  visitScheduledAt: z.nullable(z.string()),
  quoteTotal: optionalMoney,
  missionId: z.nullable(z.string()),
});

/**
 * `CleaningQuoteRequest`. `premisesType` et `quantity`, dépréciés (ADR-033), ne sont plus lus : les réponses
 * au formulaire (`answers`, `selectedOptions`, `frequency`) et le calcul (`calculation`) les remplacent.
 */
export const quoteRequestSchema = z.object({
  id: z.string(),
  status: z.string(),
  customerId: z.string(),
  customerKind: z.string(),
  organizationId: z.nullable(z.string()),
  serviceCode: z.string(),
  options: z.array(z.string()),
  answers: z.nullable(answersSchema),
  selectedOptions: z.array(optionSelectionSchema),
  frequency: z.nullable(z.string()),
  pricingVersion: z.nullable(z.int()),
  calculation: z.nullable(calculationSchema),
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
  /** Groupe des demandes créées ensemble pour un même lieu (ADR-034) ; `null` pour une demande seule. */
  groupId: z.nullable(z.string()),
  groupSize: z.int(),
  placeType: z.nullable(z.string()),
  placeTypeLabel: z.nullable(z.string()),
  /** Nom de la prestation, résolu par cleaning au moment de la réponse (ADR-034). */
  serviceName: z.nullable(z.string()),
  location: z.nullable(geoLocationSchema),
  landmark: z.nullable(z.string()),
  geocodingProvider: z.nullable(z.string()),
  geocodedAddress: z.nullable(z.string()),
  /** Détail d'une demande seulement : les autres demandes du groupe. */
  groupRequests: z.optional(z.array(groupedRequestSchema)),
  /*
   * ADR-037 : réponses lisibles et mesures constatées après la visite. Obligatoires dans le contrat, lues comme
   * facultatives : une gateway antérieure à l'ADR-037 ne casse pas la fiche (bloc des mesures sans historique).
   */
  answerSummary: z.optional(z.nullable(answerSummarySchema)),
  measuredAnswers: z.optional(z.nullable(answersSchema)),
  measuredOptions: z.optional(z.nullable(z.array(optionSelectionSchema))),
  measuredFrequency: z.optional(z.nullable(z.string())),
  measuredCalculation: z.optional(z.nullable(calculationSchema)),
  measuredPricingVersion: z.optional(z.nullable(z.int())),
  measuredAt: z.optional(z.nullable(z.string())),
  measuredBy: z.optional(z.nullable(z.string())),
  measuredByName: displayName,
  measuredSummary: z.optional(z.nullable(answerSummarySchema)),
});

/** `CleaningRequestEstimate` (ADR-037) : recalcul d'une demande avec d'autres réponses, rien n'est enregistré. */
export const requestEstimateSchema = z.object({
  requestId: z.string(),
  serviceCode: z.string(),
  commune: z.string(),
  calculation: calculationSchema,
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

/**
 * `CleaningVisit` (ADR-035) : visite technique, une seule entrée pour une visite commune ; chaque demande
 * garde sa propre visite (`visitId`, compte rendu par demande). Pour un agent, adresse, repère et position
 * d'une visite terminée ou annulée sont `null`.
 */
export const visitSchema = z.object({
  id: z.string(),
  groupVisitId: z.nullable(z.string()),
  groupId: z.nullable(z.string()),
  status: z.string(),
  scheduledAt: z.string(),
  completedAt: z.nullable(z.string()),
  report: z.nullable(z.string()),
  agentId: z.string(),
  agentName: z.nullable(z.string()),
  customerId: z.string(),
  customerName: z.nullable(z.string()),
  organizationName: z.nullable(z.string()),
  commune: z.string(),
  address: z.nullable(z.string()),
  location: z.nullable(geoLocationSchema),
  landmark: z.nullable(z.string()),
  geocodedAddress: z.nullable(z.string()),
  placeType: z.nullable(z.string()),
  placeTypeLabel: z.nullable(z.string()),
  requests: z.array(
    z.object({
      requestId: z.string(),
      visitId: z.string(),
      serviceCode: z.string(),
      serviceName: z.nullable(z.string()),
      status: z.string(),
      // Réponses du client et mesures déjà saisies (ADR-037, complément du 2026-11-06) : l'agent n'ouvre pas
      // la fiche de la demande, il préremplit ses mesures d'ici. Montants à null pour un agent seul.
      // Facultatifs : une gateway antérieure ne les envoie pas.
      answers: z.optional(z.nullable(answersSchema)),
      selectedOptions: z.optional(z.array(optionSelectionSchema)),
      frequency: z.optional(z.nullable(z.string())),
      calculation: z.optional(z.nullable(calculationSchema)),
      answerSummary: z.optional(z.nullable(answerSummarySchema)),
      measuredAnswers: z.optional(z.nullable(answersSchema)),
      measuredOptions: z.optional(z.nullable(z.array(optionSelectionSchema))),
      measuredFrequency: z.optional(z.nullable(z.string())),
      measuredAt: z.optional(z.nullable(z.string())),
      measuredByName: displayName,
      measuredSummary: z.optional(z.nullable(answerSummarySchema)),
    }),
  ),
});

export const visitListSchema = z.object({
  data: z.array(visitSchema),
  nextCursor: z.nullable(z.string()),
});

/** `CleaningFieldChoice` : valeur d'un champ à choix, avec son supplément et/ou son coefficient. */
const fieldChoiceSchema = z.object({
  code: z.string(),
  label: z.string(),
  supplement: optionalMoney,
  coefficientBp: z.nullable(z.int()),
  active: z.boolean(),
});

/** `CleaningFieldDefinition` (ADR-033) : champ du formulaire avec ses prix ; propriétés d'un autre type nulles. */
const fieldDefinitionSchema = z.object({
  code: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  helpText: z.nullable(z.string()),
  active: z.boolean(),
  unitLabel: z.nullable(z.string()),
  min: z.nullable(z.int()),
  max: z.nullable(z.int()),
  pricePerUnit: optionalMoney,
  choices: z.array(fieldChoiceSchema),
  supplementIfYes: optionalMoney,
  coefficientBpIfYes: z.nullable(z.int()),
});

/** `CleaningOptionDefinition` : option (prestation complémentaire), forfait et/ou champs propres. */
const optionDefinitionSchema = z.object({
  code: z.string(),
  label: z.string(),
  description: z.nullable(z.string()),
  active: z.boolean(),
  flatPrice: optionalMoney,
  fields: z.array(fieldDefinitionSchema),
});

/**
 * `CleaningPricing` : grille en vigueur d'une prestation (version datée, auteur). `unitPrice` et `options`,
 * dépréciés (ADR-033), ne sont plus lus.
 */
const pricingSchema = z.object({
  version: z.int(),
  minimumPrice: optionalMoney,
  frequencies: z.array(
    z.object({ code: z.string(), label: z.string(), coefficientBp: z.int(), active: z.boolean() }),
  ),
  communeCoefficients: z.array(z.object({ commune: z.string(), coefficientBp: z.int() })),
  defaultCoefficientBp: z.int(),
  teamSize: z.object({
    unitsPerAgent: z.int(),
    minAgents: z.int(),
    maxAgents: z.int(),
    fieldCode: z.optional(z.nullable(z.string())),
  }),
  checklist: z.array(z.object({ code: z.string(), label: z.string() })),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

/** `CleaningServiceDefinition` (ADR-033) : prestation complète ; `unit` (déprécié) n'est plus lu. */
export const serviceDefinitionSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  fields: z.array(fieldDefinitionSchema),
  options: z.array(optionDefinitionSchema),
  pricing: pricingSchema,
  /** Réponse de l'enregistrement seulement : lieux actifs qui proposent encore la prestation désactivée. */
  affectedPlaceTypes: z.optional(z.array(z.object({ code: z.string(), label: z.string() }))),
});

/** `CleaningServicePreview` : essai d'une grille, rien n'est enregistré. */
export const servicePreviewSchema = z.object({
  serviceCode: z.string(),
  covered: z.boolean(),
  calculation: calculationSchema,
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
  /** ADR-035 : mois de conservation de la position des dossiers clôturés (facultatif à la lecture). */
  locationRetentionMonths: z.optional(z.int()),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

export const catalogSchema = z.object({
  services: z.array(serviceDefinitionSchema),
  settings: settingsSchema,
  /** Prestations actives qu'aucun type de lieu actif ne propose (ADR-034) ; facultatif à la lecture. */
  unplacedServiceCodes: z.optional(z.array(z.string())),
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

/** `CleaningSkippedRequest` : demande laissée de côté par une opération de groupe, avec sa raison. */
const skippedRequestSchema = z.object({ requestId: z.string(), status: z.string(), reason: z.string() });

/** `CleaningGroupOutcome` (ADR-035) : résultat d'une opération de groupe, avec toutes les demandes du groupe. */
export const groupOutcomeSchema = z.object({
  groupId: z.string(),
  affectedRequestIds: z.array(z.string()),
  skipped: z.array(skippedRequestSchema),
  groupVisitId: z.nullable(z.string()),
  missionIds: z.array(z.string()),
  requests: z.array(quoteRequestSchema),
});

/** `CleaningLocationCorrection` (ADR-035) : demande à jour et dossiers modifiés par la correction. */
export const locationCorrectionSchema = z.object({
  request: quoteRequestSchema,
  updatedRequestIds: z.array(z.string()),
  updatedMissionIds: z.array(z.string()),
});

/** `CleaningPlaceType` (back-office, ADR-034) : type de lieu, prestations proposées et cohérence. */
export const placeTypeSchema = z.object({
  code: z.string(),
  label: z.string(),
  description: z.nullable(z.string()),
  icon: z.string(),
  displayOrder: z.int(),
  active: z.boolean(),
  serviceCodes: z.array(z.string()),
  unknownServiceCodes: z.array(z.string()),
  inactiveServiceCodes: z.array(z.string()),
  publiclyVisible: z.boolean(),
  visibilityReason: z.nullable(z.string()),
  updatedBy: z.nullable(z.string()),
  updatedByName: displayName,
  updatedAt: z.nullable(z.string()),
});

/** `CleaningPlaceTypeList` (back-office). */
export const placeTypeListSchema = z.object({ data: z.array(placeTypeSchema) });

/** `CleaningPlaceCatalog` (route publique) : seuls les types de lieu actifs (code et libellé) servent au filtre. */
export const publicPlaceTypesSchema = z.object({
  placeTypes: z.array(z.object({ code: z.string(), label: z.string() })),
});

/** `CleaningFormField` (public, sans prix). Bornes, aide et obligation lues comme facultatives. */
const formFieldSchema = z.object({
  code: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.optional(z.boolean()),
  helpText: z.optional(z.nullable(z.string())),
  unitLabel: z.nullable(z.string()),
  min: z.optional(z.nullable(z.int())),
  max: z.optional(z.nullable(z.int())),
  choices: z.array(z.object({ code: z.string(), label: z.string() })),
});

/**
 * Formulaires publics des prestations (`CleaningServiceForm`, route `GET /cleaning/services`) : libellés des
 * champs, valeurs, options et fréquences, pour afficher les réponses d'une demande. Éléments actifs seulement :
 * une réponse à un élément retiré s'affiche avec son code.
 */
export const serviceFormsSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      form: z.object({
        fields: z.array(formFieldSchema),
        options: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            description: z.optional(z.nullable(z.string())),
            fields: z.array(formFieldSchema),
          }),
        ),
        frequencies: z.array(z.object({ code: z.string(), label: z.string() })),
      }),
    }),
  ),
});

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
export type Calculation = z.infer<typeof calculationSchema>;
export type AnswerSummary = z.infer<typeof answerSummarySchema>;
export type Answers = z.infer<typeof answersSchema>;
export type OptionSelection = z.infer<typeof optionSelectionSchema>;
export type RequestEstimate = z.infer<typeof requestEstimateSchema>;
export type ServicePreview = z.infer<typeof servicePreviewSchema>;
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type OptionDefinition = z.infer<typeof optionDefinitionSchema>;
export type PlaceType = z.infer<typeof placeTypeSchema>;
export type GeoLocation = z.infer<typeof geoLocationSchema>;
export type GroupOutcome = z.infer<typeof groupOutcomeSchema>;
export type SkippedRequest = z.infer<typeof skippedRequestSchema>;
export type LocationCorrection = z.infer<typeof locationCorrectionSchema>;
export type ServiceForm = z.infer<typeof serviceFormsSchema>['data'][number]['form'];
export type FormField = z.infer<typeof formFieldSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type VisitList = z.infer<typeof visitListSchema>;
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
