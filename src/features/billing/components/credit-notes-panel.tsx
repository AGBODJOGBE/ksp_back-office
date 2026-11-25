'use client';

import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { creditableAmount } from '@/features/billing/credit-note-form';
import { creditNoteTexts, issuerLabel } from '@/features/billing/credit-note-texts';
import type { CreditNote, CreditNoteIssued, Invoice } from '@/features/billing/schemas';
import { billingPaths } from '@/features/billing/texts';
import { CreditNoteDialog } from './credit-note-dialog';
import { useBillingAccess } from './parts';

const l = creditNoteTexts.list;
const s = creditNoteTexts.section;

/** Colonnes d'un avoir ; la colonne « Facture » seulement dans la liste de tous les avoirs. */
export function creditNoteColumns({
  withInvoice,
  me,
}: {
  withInvoice: boolean;
  me?: string;
}): TableColumn<CreditNote>[] {
  const columns: TableColumn<CreditNote>[] = [
    {
      key: 'number',
      header: l.columns.number,
      primary: true,
      cell: (note) => <span className="text-ink font-semibold tabular-nums">{note.number}</span>,
    },
    {
      key: 'invoice',
      header: l.columns.invoice,
      cell: (note) => (
        <Link href={billingPaths.invoice(note.invoiceId)} className="text-accent-ink tabular-nums underline">
          {l.invoiceLink(note.invoiceNumber)}
        </Link>
      ),
    },
    {
      key: 'total',
      header: l.columns.total,
      className: 'tabular-nums font-semibold',
      cell: (note) => formatXof(note.total),
    },
    {
      key: 'split',
      header: l.columns.split,
      cell: (note) => (
        <span className="text-small grid gap-0.5 tabular-nums">
          <span>{l.applied(formatXof(note.appliedToBalance))}</span>
          <span>{l.credited(formatXof(note.creditedToWallet))}</span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: l.columns.reason,
      cell: (note) => <span className="max-w-xs">{note.reason}</span>,
    },
    {
      key: 'issued',
      header: l.columns.issued,
      cell: (note) => (
        <span className="grid gap-0.5">
          <span>{formatDateTime(note.issuedAt)}</span>
          <span className="text-small text-ink-muted">{l.issuedBy(issuerLabel(note.issuedBy, me))}</span>
        </span>
      ),
    },
  ];
  return withInvoice ? columns : columns.filter((column) => column.key !== 'invoice');
}

/**
 * Avoirs d'une facture (R-PE-07) et émission d'un nouvel avoir (finance seule, facture non annulée, tant
 * que le total des avoirs reste sous le total de la facture). La fiche est remplacée par la facture à
 * jour renvoyée par billing.
 */
export function CreditNotesPanel({
  invoice,
  onIssued,
  onStale,
}: {
  invoice: Invoice;
  onIssued: (issued: CreditNoteIssued) => void;
  onStale: (message: string) => void;
}) {
  const access = useBillingAccess();
  const me = useSession()?.user.id;
  const notes = invoice.creditNotes ?? [];
  const max = creditableAmount(invoice);
  const cancelled = invoice.status === 'cancelled';
  const canIssue = !!access?.creditNotes && !cancelled && max > 0;

  return (
    <Panel
      title={s.title}
      id="facture-avoirs"
      action={
        canIssue ? (
          <CreditNoteDialog invoice={invoice} max={max} onIssued={onIssued} onStale={onStale} />
        ) : null
      }
    >
      {notes.length ? (
        <ResponsiveTable
          caption={s.caption}
          columns={creditNoteColumns({ withInvoice: false, me })}
          rows={notes}
          rowKey={(note) => note.id}
        />
      ) : (
        <p className="text-small text-ink-muted">{s.none}</p>
      )}
      {access?.creditNotes ? (
        <p className="text-small text-ink-muted">
          {cancelled ? s.cancelled : max > 0 ? s.creditable(formatXof(max)) : s.nothingLeft}
        </p>
      ) : null}
    </Panel>
  );
}
