import * as z from 'zod/mini';

/*
 * Réponses de la gateway pour le Nettoyage v2 du back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/cleaning/*`, ADR-054 à ADR-059), champ par champ : un champ obligatoire absent rend la
 * réponse invalide, un champ ajouté par la gateway est ignoré. Énumérations du contrat telles quelles.
 * Montants : absents de la réponse sans la permission `cleaning.amounts.read` (champs facultatifs).
 * Schémas lus dans le navigateur : `zod/mini`.
 */

/** `Money` : entiers de FCFA, jamais de décimales. */
export const moneySchema = z.object({ amount: z.int(), currency: z.literal('XOF') });
/** Montant facultatif (masqué sans `cleaning.amounts.read`) et éventuellement nul. */
export const hiddenMoney = z.optional(z.nullable(moneySchema));

export const page = <T extends z.ZodMiniType>(item: T) =>
  z.object({ data: z.array(item), nextCursor: z.nullable(z.string()), total: z.int() });

/** Trace de la dernière modification (nom lu dans identity, `null` s'il est inconnu). */
const updated = {
  updatedAt: z.string(),
  updatedBy: z.nullable(z.string()),
  updatedByName: z.nullable(z.string()),
};

export const VISIBILITY_REASONS = [
  'inactive',
  'category_inactive',
  'no_active_offer',
  'type_inactive',
] as const;
export const PARAMETER_KINDS = ['number', 'choice', 'boolean'] as const;
export const PLANNING_MODES = ['manual', 'proposal', 'automatic'] as const;

/** `CleaningParameterChoice`. */
export const parameterChoiceSchema = z.object({ code: z.string(), label: z.string(), active: z.boolean() });

/** `CleaningParameterDefinition` : paramètre demandé au client (R-CA-01, R-CA-02). */
export const parameterSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  kind: z.enum(PARAMETER_KINDS),
  unit: z.nullable(z.string()),
  min: z.nullable(z.int()),
  max: z.nullable(z.int()),
  choices: z.array(parameterChoiceSchema),
  required: z.boolean(),
  help: z.nullable(z.string()),
  active: z.boolean(),
  ...updated,
});
export const parameterListSchema = page(parameterSchema);

/** `CleaningPlaceCategory`. */
export const placeCategorySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  icon: z.nullable(z.string()),
  order: z.int(),
  active: z.boolean(),
  /** `null` : frais de visite par défaut des réglages. */
  visitFee: hiddenMoney,
  ...updated,
});
export const placeCategoryListSchema = page(placeCategorySchema);

/** `CleaningPlaceTypeParameter` : paramètre demandé pour un lieu ou une offre, dans l'ordre. */
const placeTypeParameterSchema = z.object({ parameterId: z.string(), code: z.string(), order: z.int() });

const visibility = {
  publiclyVisible: z.boolean(),
  visibilityReasons: z.array(z.enum(VISIBILITY_REASONS)),
};

/** `CleaningPlaceType` : lieu (villa, appartement…), vue du back-office. */
export const placeTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  categoryId: z.string(),
  name: z.string(),
  icon: z.nullable(z.string()),
  photoFileId: z.nullable(z.string()),
  description: z.nullable(z.string()),
  order: z.int(),
  active: z.boolean(),
  freeDescription: z.boolean(),
  parameters: z.array(placeTypeParameterSchema),
  areaParameterId: z.nullable(z.string()),
  ...visibility,
  ...updated,
});
export const placeTypeListSchema = page(placeTypeSchema);

/** `CleaningSkill`. */
export const skillSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export const skillListSchema = page(skillSchema);

/** `CleaningChecklistTemplateItem`. */
export const checklistItemSchema = z.object({ code: z.string(), label: z.string(), order: z.int() });

/** `CleaningType` : type de nettoyage (sol, vitres…) ou pack (R-CA-04, R-CA-09). */
export const cleaningTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.nullable(z.string()),
  icon: z.nullable(z.string()),
  requiredSkillCode: z.nullable(z.string()),
  referenceDurationMinutes: z.int(),
  checklist: z.array(checklistItemSchema),
  isPack: z.boolean(),
  packItemIds: z.array(z.string()),
  active: z.boolean(),
  ...updated,
});
export const cleaningTypeListSchema = page(cleaningTypeSchema);

/** `CleaningTeamRuleBracket` : taille d'équipe et durée par tranche de superficie (R-CA-10). */
export const teamRuleBracketSchema = z.object({
  fromArea: z.int(),
  toArea: z.nullable(z.int()),
  agents: z.int(),
  durationMinutes: z.int(),
});

/** `CleaningOffer` : un type de nettoyage proposé pour un lieu, avec son tarif. */
export const offerSchema = z.object({
  id: z.string(),
  placeTypeId: z.string(),
  cleaningTypeId: z.string(),
  extraParameters: z.array(placeTypeParameterSchema),
  teamRule: z.array(teamRuleBracketSchema),
  currentTariffVersion: z.nullable(z.int()),
  draftTariffVersion: z.nullable(z.int()),
  active: z.boolean(),
  order: z.int(),
  ...visibility,
  ...updated,
});
export const offerListSchema = page(offerSchema);

/** `CleaningFrequencyCoefficient` : remise récurrente selon la fréquence (R-PX-06). */
export const frequencyCoefficientSchema = z.object({ key: z.string(), coefficientBps: z.int() });

/** `CleaningTariffBracket`. */
export const tariffBracketSchema = z.object({
  from: z.int(),
  to: z.int(),
  mode: z.enum(['flat', 'per_unit']),
  amount: z.optional(moneySchema),
});

/** `CleaningTariffSupplement`. */
export const tariffSupplementSchema = z.object({
  parameterCode: z.string(),
  choiceCode: z.nullable(z.string()),
  mode: z.enum(['fixed', 'per_unit', 'coefficient']),
  amount: hiddenMoney,
  coefficientBps: z.nullable(z.int()),
  includedUnits: z.int(),
});

/** `CleaningTariff` : version de tarif d'une offre (R-CA-07, R-CA-08). */
export const tariffSchema = z.object({
  id: z.string(),
  offerId: z.string(),
  version: z.int(),
  status: z.enum(['draft', 'published', 'archived']),
  baseParameterCode: z.nullable(z.string()),
  brackets: z.array(tariffBracketSchema),
  supplements: z.array(tariffSupplementSchema),
  minimum: z.optional(moneySchema),
  frequencyCoefficients: z.array(frequencyCoefficientSchema),
  createdAt: z.string(),
  createdBy: z.string(),
  publishedAt: z.nullable(z.string()),
  publishedBy: z.nullable(z.string()),
  packDiscountBps: z.nullable(z.int()),
  createdByName: z.nullable(z.string()),
  publishedByName: z.nullable(z.string()),
});
export const tariffListSchema = page(tariffSchema);

/** `CleaningPriceRange` : fourchette affichée (R-PX-07). */
const priceRangeSchema = z.object({ low: z.optional(moneySchema), high: z.optional(moneySchema) });

/** `CleaningPricingLine` : ligne du détail du calcul (R-PX-04). */
export const pricingLineSchema = z.object({
  kind: z.enum(['bracket', 'supplement', 'coefficient', 'frequency', 'minimum', 'pack_discount', 'commune']),
  label: z.string(),
  parameterCode: z.nullable(z.string()),
  quantity: z.nullable(z.int()),
  unitAmount: hiddenMoney,
  coefficientBps: z.nullable(z.int()),
  amount: hiddenMoney,
});

/** `CleaningPricedOffer` : prix d'un type de nettoyage pour une séance. */
export const pricedOfferSchema = z.object({
  offerId: z.string(),
  cleaningTypeId: z.string(),
  cleaningTypeCode: z.string(),
  name: z.string(),
  tariffVersion: z.nullable(z.int()),
  status: z.enum(['priced', 'on_quote']),
  minimumApplied: z.boolean(),
  price: hiddenMoney,
  lines: z.array(pricingLineSchema),
  onQuoteReason: z.nullable(
    z.enum(['no_published_tariff', 'above_last_bracket', 'below_first_bracket', 'base_value_missing']),
  ),
  tariffStatus: z.nullable(z.enum(['published', 'draft'])),
});

/** `CleaningPricing` : résultat du calcul (partie 5). */
export const pricingSchema = z.object({
  communeKey: z.nullable(z.string()),
  communeCoefficientBps: z.int(),
  offers: z.array(pricedOfferSchema),
  complete: z.boolean(),
  packDiscount: hiddenMoney,
  sessionPrice: hiddenMoney,
  range: z.nullable(priceRangeSchema),
  sessionsCount: z.nullable(z.int()),
  programTotal: hiddenMoney,
  frequencyDiscount: hiddenMoney,
  visitFee: hiddenMoney,
  calculatedAt: z.string(),
  pricedSubtotal: hiddenMoney,
  status: z.enum(['priced', 'partially_priced', 'on_quote']),
  programRange: z.nullable(priceRangeSchema),
  teamSize: z.nullable(z.int()),
  durationMinutes: z.nullable(z.int()),
});

/** `CleaningSchedulePreview` : dates exactes d'un programme (R-PG-04). */
const schedulePreviewSchema = z.object({
  occurrences: z.array(z.object({ date: z.string(), start: z.string() })),
  count: z.int(),
  firstStart: z.nullable(z.string()),
  lastStart: z.nullable(z.string()),
  notices: z.array(
    z.object({
      code: z.enum([
        'month_day_adjusted',
        'holiday_excluded',
        'date_excluded',
        'date_added',
        'excluded_not_planned',
        'added_already_planned',
      ]),
      date: z.string(),
      label: z.nullable(z.string()),
    }),
  ),
});

/** `CleaningSimulation` : estimation non contractuelle. */
export const simulationSchema = z.object({
  pricing: pricingSchema,
  schedule: z.nullable(schedulePreviewSchema),
  disclaimer: z.string(),
  covered: z.boolean(),
  communeApplied: z.boolean(),
  notices: z.array(z.enum(['no_commune', 'commune_not_covered', 'partially_priced', 'on_quote'])),
  usesDrafts: z.boolean(),
});

/** `CleaningHoliday` : jour férié national (R-PG-02). */
export const holidaySchema = z.object({ id: z.string(), date: z.string(), name: z.string() });
export const holidayListSchema = page(holidaySchema);

/** `CleaningZone` : commune desservie (R-ZN-01). */
export const zoneSchema = z.object({
  id: z.string(),
  communeKey: z.string(),
  name: z.string(),
  coefficientBps: z.int(),
  /** `null` : aucune majoration. */
  visitFeeSurcharge: hiddenMoney,
  /** `null` : réglage général. */
  planningMode: z.nullable(z.enum(PLANNING_MODES)),
  active: z.boolean(),
  openRequests: z.int(),
  activePrograms: z.int(),
  ...updated,
});
export const zoneListSchema = page(zoneSchema);

/** `CleaningCommuneOption` : commune du référentiel de geo et sa zone (R-ZN-03). */
export const communeSchema = z.object({
  communeKey: z.string(),
  name: z.string(),
  zoneId: z.nullable(z.string()),
  zoneActive: z.boolean(),
});
export const communeListSchema = z.object({ data: z.array(communeSchema) });

/** `CleaningScoreWeights` : poids du score des candidats (R-PL-03), total 100. */
const scoreWeightsSchema = z.object({
  continuity: z.int(),
  proximity: z.int(),
  balance: z.int(),
  rating: z.int(),
});

/** `CleaningSettings` : réglages du module (partie 16.1). */
export const settingsSchema = z.object({
  maxOpenRequestsPerAccount: z.int(),
  minVisitLeadHours: z.int(),
  visitFeePaymentHours: z.int(),
  visitTargetBusinessHours: z.int(),
  visitDurationMinutes: z.int(),
  defaultTravelMinutes: z.int(),
  defaultVisitFee: z.optional(moneySchema),
  deductVisitFee: z.boolean(),
  quoteValidityDays: z.int(),
  quoteReminderDays: z.int(),
  maxDiscountWithoutApprovalPercent: z.int(),
  firstSessionLeadHours: z.int(),
  programMaxMonths: z.int(),
  programMaxSessions: z.int(),
  freeCancellationHours: z.int(),
  reschedulesPerMonth: z.int(),
  lateCancellationFeePercent: z.int(),
  sessionPaymentGraceHours: z.int(),
  overdueSessionsBeforeSuspension: z.int(),
  balanceGuarantee: z.boolean(),
  unpaidInvoicesWarning: z.int(),
  unpaidInvoicesSuspension: z.int(),
  defaultPlanningMode: z.enum(PLANNING_MODES),
  planningHorizonDays: z.int(),
  scoreWeights: scoreWeightsSchema,
  assignmentResponseHours: z.int(),
  defaultMaxHoursPerDay: z.int(),
  defaultMaxHoursPerWeek: z.int(),
  maxPhotosPerKind: z.int(),
  claimWindowHours: z.int(),
  retentionMonths: z.int(),
  commonChecklist: z.array(checklistItemSchema),
  arrivalAlertMeters: z.int(),
  arrivalMaxAdvanceMinutes: z.int(),
  customerWaitMinutes: z.int(),
  ...updated,
});

export type Money = z.infer<typeof moneySchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type ParameterKind = Parameter['kind'];
export type ParameterChoice = z.infer<typeof parameterChoiceSchema>;
export type PlaceCategory = z.infer<typeof placeCategorySchema>;
export type PlaceType = z.infer<typeof placeTypeSchema>;
export type PlaceTypeParameter = z.infer<typeof placeTypeParameterSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type CleaningType = z.infer<typeof cleaningTypeSchema>;
export type TeamRuleBracket = z.infer<typeof teamRuleBracketSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Tariff = z.infer<typeof tariffSchema>;
export type TariffSupplement = z.infer<typeof tariffSupplementSchema>;
export type FrequencyCoefficient = z.infer<typeof frequencyCoefficientSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type PricedOffer = z.infer<typeof pricedOfferSchema>;
export type PricingLine = z.infer<typeof pricingLineSchema>;
export type Simulation = z.infer<typeof simulationSchema>;
export type Holiday = z.infer<typeof holidaySchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type PlanningMode = (typeof PLANNING_MODES)[number];
export type Commune = z.infer<typeof communeSchema>;
export type CleaningSettings = z.infer<typeof settingsSchema>;
export type VisibilityReason = (typeof VISIBILITY_REASONS)[number];

/** Page d'une liste paginée par curseur (`total` : éléments qui correspondent aux filtres). */
export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}
