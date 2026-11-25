import type { Page } from '@/lib/use-paged-list';
import { PAGE_SIZE, path, read, send, xof } from './api';
import {
  type AdminCase,
  adminCaseSchema,
  type Case,
  caseSchema,
  casePageSchema,
  type ContactChannel,
  type ContactOutcome,
  type DisputeResolution,
  type MessageChannel,
  type MessageTemplate,
  type PaymentPlan,
  paymentPlanSchema,
  type PlanRhythm,
  promiseSchema,
  type RejectionReason,
} from './case-schemas';
import {
  type JournalEntry,
  journalEntrySchema,
  journalPageSchema,
  settlementSchema,
} from './journal-schemas';
import type { CaseFilterKey } from './paths';
import type { CaseStage, CaseSummary } from './schemas';

/*
 * Dossiers du Recouvrement (routes `/api/v1/admin/recovery/cases*` et `/payment-plans/{id}/approval`).
 * Les routes qui prévoient `Idempotency-Key` la reçoivent de l'écran (clé gardée tant que l'issue est
 * inconnue) ; les autres n'en envoient pas.
 */

/** Filtres de la file traduits pour la gateway (noms du contrat). */
export type CaseQuery = Partial<Record<CaseFilterKey, string | number | boolean>>;

export interface CasePage extends Page<CaseSummary> {
  total: number;
}

/** Une page de dossiers, avec le total des dossiers qui répondent aux filtres. */
export function listCases(filters: CaseQuery) {
  return async (cursor?: string): Promise<CasePage> => {
    const page = await read(casePageSchema, path('cases'), { limit: PAGE_SIZE, ...filters, cursor });
    return { data: page.cases, nextCursor: page.nextCursor, total: page.total };
  };
}

export const getCase = (id: string): Promise<AdminCase> => read(adminCaseSchema, path('cases', id));

/** Journal complet du dossier, notes internes comprises, une page à la fois. */
export function listJournal(id: string) {
  return async (cursor?: string): Promise<Page<JournalEntry>> => {
    const page = await read(journalPageSchema, path('cases', id, 'journal'), { limit: PAGE_SIZE, cursor });
    return { data: page.entries, nextCursor: page.nextCursor };
  };
}

export interface Assessment {
  decision: 'accept' | 'request_info' | 'reject';
  note?: string;
  agentUserId?: string;
  rejectionReason?: RejectionReason;
}

export const assessCase = (id: string, body: Assessment, key: string): Promise<Case> =>
  send(caseSchema, 'post', path('cases', id, 'assessment'), body, key);

export const assignCase = (id: string, agentUserId: string): Promise<Case> =>
  send(caseSchema, 'post', path('cases', id, 'assign'), { agentUserId });

export interface ContactInput {
  debtorId?: string;
  channel: ContactChannel;
  direction: 'outbound' | 'inbound';
  outcome: ContactOutcome;
  occurredAt: string;
  callbackAt?: string;
  note?: string;
}

export const recordContact = (id: string, body: ContactInput, key: string): Promise<JournalEntry> =>
  send(journalEntrySchema, 'post', path('cases', id, 'contacts'), body, key);

export const recordPromise = (id: string, amount: number, dueDate: string, note: string, key: string) =>
  send(
    promiseSchema,
    'post',
    path('cases', id, 'promises'),
    { amount: xof(amount), dueDate, ...(note ? { note } : {}) },
    key,
  );

export interface MessageInput {
  debtorId: string;
  template: MessageTemplate;
  channel?: MessageChannel;
}

export const sendDebtorMessage = (id: string, body: MessageInput, key: string): Promise<JournalEntry> =>
  send(journalEntrySchema, 'post', path('cases', id, 'messages'), body, key);

export const addNote = (id: string, text: string): Promise<JournalEntry> =>
  send(journalEntrySchema, 'post', path('cases', id, 'notes'), { text });

export interface PlanInput {
  firstAmount: number;
  firstDueDate: string;
  rhythm: PlanRhythm;
  installmentsCount: number;
  note?: string;
}

export function proposePlan(id: string, input: PlanInput, key: string): Promise<PaymentPlan> {
  const { note, firstAmount, ...terms } = input;
  const body = { terms: { firstAmount: xof(firstAmount), ...terms }, ...(note ? { note } : {}) };
  return send(paymentPlanSchema, 'post', path('cases', id, 'payment-plans'), body, key);
}

export const decidePlan = (planId: string, decision: 'approve' | 'reject', note: string) =>
  send(paymentPlanSchema, 'post', path('payment-plans', planId, 'approval'), {
    decision,
    ...(note ? { note } : {}),
  });

export const proposeSettlement = (
  id: string,
  payNow: number,
  validUntil: string,
  note: string,
  key: string,
) =>
  send(
    settlementSchema,
    'post',
    path('cases', id, 'settlements'),
    { payNow: xof(payNow), validUntil, ...(note ? { note } : {}) },
    key,
  );

export const changeStage = (id: string, toStage: CaseStage, reason: string): Promise<Case> =>
  send(caseSchema, 'post', path('cases', id, 'stage'), { toStage, reason });

export interface DisputeDecision {
  resolution: DisputeResolution;
  correctedDue?: number;
  note: string;
}

export function resolveDispute(id: string, disputeId: string, input: DisputeDecision): Promise<Case> {
  const { correctedDue, ...rest } = input;
  const body = { ...rest, ...(correctedDue === undefined ? {} : { correctedDue: xof(correctedDue) }) };
  return send(caseSchema, 'post', path('cases', id, 'disputes', disputeId, 'resolution'), body);
}

/** Remboursement d'un trop-perçu fait à la main par la finance (ADR-060, décision 9) : tracé et soldé. */
export function recordOverpaymentRefund(
  caseId: string,
  input: { amount: number; reference: string; note?: string },
  key: string,
): Promise<Case> {
  const { amount, ...rest } = input;
  return send(
    caseSchema,
    'post',
    path('cases', caseId, 'overpayment-refunds'),
    { ...rest, amount: xof(amount) },
    key,
  );
}
