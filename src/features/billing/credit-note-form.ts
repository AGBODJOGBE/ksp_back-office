import { formatXof } from '@/lib/format';
import type { CreditNoteLineInput } from './api';
import { creditNoteTexts } from './credit-note-texts';
import type { Invoice } from './schemas';

/*
 * Règles du formulaire d'avoir (contrat `IssueCreditNoteRequest`, R-PE-07), sans React : lignes
 * positives (1 à 50, libellé de 200 caractères au plus), motif de 500 caractères au plus, total jamais
 * au-delà de ce qui reste possible en avoir. Le service billing reste seul juge.
 */

const t = creditNoteTexts.issue;
export const MAX_LINES = 50;
export const LABEL_MAX = 200;
export const REASON_MAX = 500;

export interface LineDraft {
  key: number;
  label: string;
  amount: string;
}

export interface CreditNoteDraft {
  lines: LineDraft[];
  reason: string;
}

export interface CreditNoteErrors {
  /** Par ligne (clé de la ligne) : libellé ou montant. */
  lines: Record<number, { label?: string; amount?: string }>;
  reason?: string;
  total?: string;
}

/** Montant saisi (espaces tolérés) en entier de FCFA, ou `null` s'il n'en est pas un. */
export function parseAmount(raw: string): number | null {
  const compact = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * Ce qui reste possible en avoir : total de la facture moins les avoirs déjà émis (« le total des
 * avoirs d'une facture ne dépasse jamais son total »). Facture v1 sans `creditNotes` : aucun avoir connu.
 */
export function creditableAmount(invoice: Invoice): number {
  const issued = (invoice.creditNotes ?? []).reduce((sum, note) => sum + note.total.amount, 0);
  return Math.max(0, invoice.total.amount - issued);
}

/** Part imputée sur le reste dû, puis part créditée au portefeuille (prévision ; billing tranche). */
export function splitPreview(total: number, balance: number): { applied: number; credited: number } {
  const applied = Math.min(total, Math.max(0, balance));
  return { applied, credited: total - applied };
}

export function validateCreditNote(
  draft: CreditNoteDraft,
  max: number,
): {
  request: { lines: CreditNoteLineInput[]; reason: string; total: number } | null;
  errors: CreditNoteErrors;
} {
  const errors: CreditNoteErrors = { lines: {} };
  const lines: CreditNoteLineInput[] = [];
  for (const line of draft.lines) {
    const label = line.label.trim();
    const amount = parseAmount(line.amount);
    const lineErrors: { label?: string; amount?: string } = {};
    if (!label) lineErrors.label = t.labelRequired;
    if (amount === null) lineErrors.amount = t.invalidAmount;
    if (lineErrors.label || lineErrors.amount) errors.lines[line.key] = lineErrors;
    else if (amount !== null) lines.push({ label: label.slice(0, LABEL_MAX), amount });
  }
  const reason = draft.reason.trim();
  if (!reason) errors.reason = t.reasonRequired;
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const complete = lines.length === draft.lines.length && lines.length > 0;
  if (complete && total > max) errors.total = t.exceeds(formatXof(max));
  const valid = complete && !errors.reason && !errors.total;
  return { request: valid ? { lines, reason, total } : null, errors };
}

/** Première erreur à mettre au point (identifiant du champ), ou `null`. */
export function firstInvalidField(draft: CreditNoteDraft, errors: CreditNoteErrors): string | null {
  for (const line of draft.lines) {
    const lineErrors = errors.lines[line.key];
    if (lineErrors?.label) return `avoir-libelle-${line.key}`;
    if (lineErrors?.amount) return `avoir-montant-${line.key}`;
  }
  if (errors.reason) return 'avoir-motif';
  if (errors.total) return `avoir-montant-${draft.lines[0]?.key ?? 0}`;
  return null;
}
