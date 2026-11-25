import * as z from 'zod/mini';
import { actorSchema, moneySchema } from './schemas';

/*
 * Réglages du recouvrement (`GET`, `PUT /api/v1/admin/recovery/settings`, partie 17.1) et jours fériés
 * (`GET`, `PUT /api/v1/admin/recovery/holidays/{year}`). Bornes du contrat dans `SETTING_BOUNDS` : le
 * formulaire les affiche et les vérifie avant l'envoi ; le service reste seul juge
 * (`RECOVERY_SETTING_OUT_OF_BOUNDS`).
 */

/** `RecoveryPlanScale` : barème d'échéancier par défaut d'une offre. */
export const planScaleSchema = z.object({
  acceptsPaymentPlan: z.boolean(),
  maxDurationMonths: z.int(),
  minFirstPaymentBps: z.int(),
  firstPaymentWithinDays: z.int(),
  minInstallment: moneySchema,
  maxDiscountBps: z.int(),
});
export type PlanScale = z.infer<typeof planScaleSchema>;

/** `RecoveryContactWindow` : plage de contact (heure du Bénin, jours ISO 1 = lundi). */
export const contactWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.array(z.int()),
});

export const SCORE_CRITERIA = [
  'debtAge',
  'writtenAcknowledgment',
  'evidenceQuality',
  'amount',
  'validContacts',
  'partialPayments',
] as const;
export type ScoreCriterion = (typeof SCORE_CRITERIA)[number];

/** `RecoveryScoreWeights` : poids des critères du score (somme ramenée à 100 par le service). */
export const scoreWeightsSchema = z.object({
  debtAge: z.int(),
  writtenAcknowledgment: z.int(),
  evidenceQuality: z.int(),
  amount: z.int(),
  validContacts: z.int(),
  partialPayments: z.int(),
});

/** Réglages entiers (délais, seuils), dans l'ordre du formulaire. */
export const DAY_SETTINGS = [
  'feePaymentDays',
  'reviewBusinessDays',
  'infoCompletionDays',
  'noticeResponseDays',
  'installmentGraceDays',
  'missedInstallmentsBeforeAmicable',
  'amicableDurationDays',
  'formalNoticeDays',
  'creditorApprovalDays',
  'planCreditorApprovalDays',
  'disputeAnswerDays',
  'prescriptionAlertDays',
  'debtorLinkDays',
  'debtorSessionMinutes',
  'remittanceBusinessDays',
  'partnerSilenceAlertDays',
  'unrecoverableAfterMonths',
  'closedCaseRetentionYears',
] as const;
export type DaySetting = (typeof DAY_SETTINGS)[number];

/** Bornes du contrat (`minimum`, `maximum`) de chaque réglage entier. */
export const SETTING_BOUNDS: Record<DaySetting, readonly [number, number]> = {
  feePaymentDays: [1, 30],
  reviewBusinessDays: [1, 10],
  infoCompletionDays: [3, 60],
  noticeResponseDays: [3, 30],
  installmentGraceDays: [0, 15],
  missedInstallmentsBeforeAmicable: [1, 5],
  amicableDurationDays: [7, 90],
  formalNoticeDays: [8, 60],
  creditorApprovalDays: [3, 60],
  planCreditorApprovalDays: [1, 15],
  disputeAnswerDays: [3, 30],
  prescriptionAlertDays: [30, 365],
  debtorLinkDays: [7, 90],
  debtorSessionMinutes: [5, 120],
  remittanceBusinessDays: [1, 30],
  partnerSilenceAlertDays: [3, 60],
  unrecoverableAfterMonths: [1, 24],
  closedCaseRetentionYears: [1, 10],
};

/** Bornes du contrat d'un barème d'échéancier. */
export const SCALE_BOUNDS = {
  maxDurationMonths: [1, 36],
  minFirstPaymentBps: [0, 10000],
  firstPaymentWithinDays: [1, 90],
  maxDiscountBps: [0, 10000],
} as const;

export const SCALES = ['defaultB2bScale', 'defaultB2cScale', 'defaultRentScale'] as const;
export type ScaleKey = (typeof SCALES)[number];

/** `RecoverySettings`. */
export const settingsSchema = z.object({
  minimumCaseAmount: moneySchema,
  feePaymentDays: z.int(),
  reviewBusinessDays: z.int(),
  infoCompletionDays: z.int(),
  noticeResponseDays: z.int(),
  installmentGraceDays: z.int(),
  missedInstallmentsBeforeAmicable: z.int(),
  amicableDurationDays: z.int(),
  formalNoticeDays: z.int(),
  creditorApprovalDays: z.int(),
  disputeAnswerDays: z.int(),
  prescriptionAlertDays: z.int(),
  contactWindow: contactWindowSchema,
  debtorLinkDays: z.int(),
  remittanceBusinessDays: z.int(),
  closedCaseRetentionYears: z.int(),
  defaultB2bScale: planScaleSchema,
  defaultB2cScale: planScaleSchema,
  defaultRentScale: planScaleSchema,
  scoreWeights: scoreWeightsSchema,
  planCreditorApprovalDays: z.int(),
  partnerSilenceAlertDays: z.int(),
  debtorSessionMinutes: z.int(),
  unrecoverableAfterMonths: z.int(),
});
export type Settings = z.infer<typeof settingsSchema>;

/** `RecoverySettingsView` : réglages et dernière modification. */
export const settingsViewSchema = z.object({
  settings: settingsSchema,
  updatedAt: z.nullable(z.string()),
  updatedBy: z.nullable(actorSchema),
});
export type SettingsView = z.infer<typeof settingsViewSchema>;

/** `RecoveryHoliday` : jour du calendrier (`AAAA-MM-JJ`) et libellé (1 à 100 caractères). */
export const holidaySchema = z.object({ date: z.string(), label: z.string() });
export type Holiday = z.infer<typeof holidaySchema>;

/** `RecoveryHolidays` : liste d'une année (40 au plus). */
export const holidaysSchema = z.object({ holidays: z.array(holidaySchema) });
export const MAX_HOLIDAYS = 40;
export const HOLIDAY_YEARS = [2020, 2100] as const;
