import * as z from 'zod/mini';
import {
  actorSchema,
  CASE_KINDS,
  CASE_STAGES,
  CASE_STATUSES,
  caseSummarySchema,
  deadlineSchema,
  moneySchema,
  partySchema,
} from './schemas';

/*
 * File et fiche d'un dossier (contrat `ksp-api.v1.yaml` : `RecoveryCasePage`, `RecoveryAdminCase`) et
 * énumérations des actions. Seuls les champs lus par les écrans sont décrits, fidèles au contrat ; les
 * autres (mandat, pièces, devis, provisions, partenaire…) sont ignorés. Journal, remise et paiements
 * hors ligne : `journal-schemas.ts`.
 */

const nullableString = z.nullable(z.string());
const stage = z.enum(CASE_STAGES);

export const PLAN_RHYTHMS = ['weekly', 'biweekly', 'monthly'] as const;
export const PLAN_VIOLATIONS = ['duration', 'first_payment', 'installment_minimum'] as const;
export const CONTACT_CHANNELS = ['phone', 'sms', 'whatsapp', 'email', 'letter', 'visit'] as const;
export const CONTACT_OUTCOMES = [
  'reached',
  'no_answer',
  'wrong_number',
  'refused',
  'promise',
  'callback_requested',
  'delivered',
  'failed',
] as const;
export const MESSAGE_TEMPLATES = ['reminder', 'payment_link', 'plan_reminder', 'callback_missed'] as const;
export const MESSAGE_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export const REJECTION_REASONS = [
  'prescribed',
  'illegal',
  'no_evidence',
  'debtor_unreachable',
  'other',
] as const;
export const CASE_NATURES = [
  'unpaid_invoice',
  'loan',
  'acknowledgment_of_debt',
  'bounced_cheque',
  'service',
  'sale',
  'rent',
  'other',
] as const;
export const CLOSURE_REASONS = [
  'paid',
  'settlement_executed',
  'dispute_upheld',
  'abandoned_by_creditor',
  'unrecoverable',
  'prescribed',
] as const;
export const DISPUTE_RESOLUTIONS = ['resume', 'correct_amount', 'close'] as const;

export type PlanRhythm = (typeof PLAN_RHYTHMS)[number];
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];
export type MessageTemplate = (typeof MESSAGE_TEMPLATES)[number];
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type RejectionReason = (typeof REJECTION_REASONS)[number];
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

/** `RecoveryCasePage` : une page de la file, avec le total des dossiers filtrés. */
export const casePageSchema = z.object({
  cases: z.array(caseSummarySchema),
  nextCursor: nullableString,
  total: z.int(),
});

/** `RecoveryDebtor` : coordonnées affichées seulement parce que le contrat les renvoie. */
const debtorSchema = z.object({
  id: z.string(),
  kind: z.enum(['person', 'company']),
  role: z.enum(['main', 'co_debtor', 'guarantor']),
  displayName: z.string(),
  representativeName: nullableString,
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  address: nullableString,
  communeKey: nullableString,
});
export type Debtor = z.infer<typeof debtorSchema>;

const claimSchema = z.object({
  id: z.string(),
  reference: z.string(),
  amount: moneySchema,
  dueDate: z.string(),
  description: nullableString,
});

/** `RecoveryPlanScale` : barème du créancier figé sur le dossier. */
const planScaleSchema = z.object({
  acceptsPaymentPlan: z.boolean(),
  maxDurationMonths: z.int(),
  minFirstPaymentBps: z.int(),
  firstPaymentWithinDays: z.int(),
  minInstallment: moneySchema,
  maxDiscountBps: z.int(),
});
export type PlanScale = z.infer<typeof planScaleSchema>;

const amountsSchema = z.object({
  principal: moneySchema,
  interests: moneySchema,
  costs: moneySchema,
  paid: moneySchema,
  waived: moneySchema,
  due: moneySchema,
  overpaid: moneySchema,
});

const installmentSchema = z.object({
  id: nullableString,
  rank: z.int(),
  dueDate: z.string(),
  amount: moneySchema,
  paidAmount: moneySchema,
  status: z.enum(['upcoming', 'due', 'paid', 'partial', 'missed']),
  paidAt: nullableString,
});

/** `RecoveryPaymentPlan`. */
export const paymentPlanSchema = z.object({
  id: z.string(),
  status: z.enum([
    'proposed',
    'pending_creditor',
    'signed',
    'completed',
    'defaulted',
    'rejected',
    'cancelled',
  ]),
  terms: z.object({
    firstAmount: moneySchema,
    firstDueDate: z.string(),
    rhythm: z.enum(PLAN_RHYTHMS),
    installmentsCount: z.int(),
  }),
  total: moneySchema,
  installments: z.array(installmentSchema),
  withinScale: z.boolean(),
  violations: z.array(z.enum(PLAN_VIOLATIONS)),
  proposedBy: z.enum(['debtor', 'agent']),
  renegotiation: z.boolean(),
  signedAt: nullableString,
  missedCount: z.int(),
  createdAt: z.string(),
});
export type PaymentPlan = z.infer<typeof paymentPlanSchema>;

/** `RecoveryPromise`. */
export const promiseSchema = z.object({
  id: z.string(),
  amount: moneySchema,
  dueDate: z.string(),
  status: z.enum(['pending', 'kept', 'broken', 'cancelled']),
  recordedBy: actorSchema,
  createdAt: z.string(),
});

const collectionSchema = z.object({
  id: z.string(),
  source: z.enum(['payment_link', 'offline_cash', 'offline_transfer', 'partner', 'direct_to_creditor']),
  gross: moneySchema,
  overpaid: moneySchema,
  commission: moneySchema,
  netToCreditor: moneySchema,
  stage,
  receivedAt: z.string(),
});

const disputeSchema = z.object({
  id: z.string(),
  reason: z.enum(['already_paid', 'wrong_amount', 'service_not_rendered', 'wrong_person', 'other']),
  text: z.string(),
  status: z.enum(['open', 'creditor_answered', 'upheld', 'rejected', 'amount_corrected']),
  openedAt: z.string(),
  creditorAnswerDueAt: z.string(),
  creditorAnswer: nullableString,
  resolutionNote: nullableString,
  resolvedAt: nullableString,
});
export type Dispute = z.infer<typeof disputeSchema>;

const transitionSchema = z.object({
  fromStage: z.nullable(stage),
  toStage: stage,
  at: z.string(),
  by: actorSchema,
  reason: nullableString,
  skipReason: z.nullable(z.enum(['prescription_near', 'asset_flight_risk'])),
});

/** `RecoveryCase`, champs lus par la fiche. */
export const caseSchema = z.object({
  id: z.string(),
  number: z.string(),
  kind: z.enum(CASE_KINDS),
  nature: z.enum(CASE_NATURES),
  status: z.enum(CASE_STATUSES),
  stage: z.nullable(stage),
  creditor: partySchema,
  debtors: z.array(debtorSchema),
  claims: z.array(claimSchema),
  planScale: planScaleSchema,
  amounts: amountsSchema,
  prescriptionDate: nullableString,
  score: z.nullable(z.int()),
  assignedAgent: z.nullable(actorSchema),
  pricing: z.nullable(z.object({ commissionSummary: z.string() })),
  currentPlan: z.nullable(paymentPlanSchema),
  promises: z.array(promiseSchema),
  collections: z.array(collectionSchema),
  disputes: z.array(disputeSchema),
  stageHistory: z.array(transitionSchema),
  nextDeadline: z.nullable(deadlineSchema),
  reviewNote: nullableString,
  rejectionReason: z.nullable(z.enum([...REJECTION_REASONS, 'incomplete'])),
  closure: z.nullable(
    z.object({ reason: z.enum(CLOSURE_REASONS), note: nullableString, closedAt: z.string() }),
  ),
  createdAt: z.string(),
  submittedAt: nullableString,
  acceptedAt: nullableString,
  updatedAt: z.string(),
});
export type Case = z.infer<typeof caseSchema>;

/** `RecoveryAdminCase` : le dossier, le détail du score et l'injonction de payer possible. */
export const adminCaseSchema = z.object({
  case: caseSchema,
  scoreFactors: z.array(z.object({ criterion: z.string(), value: z.string(), points: z.int() })),
  injunctionEligible: z.boolean(),
});
export type AdminCase = z.infer<typeof adminCaseSchema>;
