'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDate, formatDateTime, formatDuration } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { formatPercentBps } from '@/features/cleaning/inputs';
import { quoteTexts } from '@/features/cleaning/quote-texts';
import { getQuote } from '@/features/cleaning/requests-api';
import type { Quote } from '@/features/cleaning/requests-schemas';
import { quoteStatus } from '@/features/cleaning/request-work-texts';
import { StatusBadge } from './request-parts';
import { Amount, ResourceView } from './parts';

const t = quoteTexts;
type Line = Quote['lines'][number];

const lineColumns: TableColumn<Line>[] = [
  {
    key: 'name',
    header: t.columns.name,
    primary: true,
    cell: (line) => (line.kind === 'pack_discount' ? `${line.name} (${t.packDiscount})` : line.name),
  },
  {
    key: 'quantity',
    header: t.columns.quantity,
    className: 'tabular-nums',
    cell: (line) => `${line.quantity}${line.unit ? ` ${line.unit}` : ''}`,
  },
  { key: 'unit', header: t.columns.unitPrice, cell: (line) => <Amount value={line.unitPrice} /> },
  { key: 'amount', header: t.columns.amount, cell: (line) => <Amount value={line.amount} /> },
];

/** Un devis : état, lignes, ajustements, prix et conditions (montants masqués sans le droit). */
export function QuoteView({ quote, title }: { quote: Quote; title: string }) {
  const first = quote.sessionStarts[0];
  return (
    <article aria-label={title} className="rounded-control border-line grid gap-3 border p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink font-semibold">{title}</h3>
        <StatusBadge status={quoteStatus(quote.status)} />
        <Badge>{t.version(quote.version)}</Badge>
        <Badge>{t.kinds[quote.kind] ?? quote.kind}</Badge>
      </div>
      {quote.lines.length ? (
        <ResponsiveTable
          caption={t.linesCaption(quote.version)}
          columns={lineColumns}
          rows={quote.lines}
          rowKey={(line) => `${line.kind}-${line.offerId}`}
        />
      ) : null}
      {quote.adjustments.length ? (
        <div className="grid gap-1">
          <h4 className="text-ink font-semibold">{t.adjustments}</h4>
          <ul className="grid gap-1">
            {quote.adjustments.map((adjustment, index) => (
              <li key={`${adjustment.kind}-${index}`} className="flex flex-wrap items-center gap-2">
                <span>
                  {t.adjustmentKinds[adjustment.kind] ?? adjustment.kind}{' '}
                  {adjustment.percentBps === null ? null : formatPercentBps(adjustment.percentBps)}
                </span>
                <Amount value={adjustment.amount} />
                <span className="text-small text-ink-muted">« {adjustment.reason} »</span>
                <Badge tone={adjustment.approvalStatus === 'pending' ? 'warning' : 'neutral'}>
                  {t.approval[adjustment.approvalStatus] ?? adjustment.approvalStatus}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <DescriptionList
        items={[
          { term: t.sessionPrice, value: <Amount value={quote.sessionPrice} /> },
          { term: t.sessions, value: String(quote.sessionsCount) },
          { term: t.total, value: <Amount value={quote.total} /> },
          { term: t.feeDeduction, value: <Amount value={quote.visitFeeDeduction} /> },
          { term: t.team, value: String(quote.teamSize) },
          { term: t.duration, value: formatDuration(quote.durationMinutes) },
          { term: t.payment, value: t.payments[quote.paymentTerms] ?? quote.paymentTerms },
          { term: t.firstSession, value: first ? formatDateTime(first) : null },
          { term: t.validUntil, value: quote.validUntil ? formatDate(quote.validUntil) : null },
          { term: t.sentAt, value: quote.sentAt ? formatDateTime(quote.sentAt) : null },
          { term: t.respondedAt, value: quote.respondedAt ? formatDateTime(quote.respondedAt) : null },
          { term: t.terms, value: quote.termsVersion },
          { term: t.pdf, value: quote.pdfDocumentId ? t.pdfReady : null },
        ]}
      />
    </article>
  );
}

/** Version précédente, relue à la demande (`GET /quotes/{id}`) pour afficher son détail à jour. */
function HistoryItem({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink font-semibold">{t.version(quote.version)}</span>
        <StatusBadge status={quoteStatus(quote.status)} />
        {quote.sentAt ? (
          <span className="text-small text-ink-muted">
            {t.sentAt} {formatDate(quote.sentAt)}
          </span>
        ) : null}
        <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t.hideDetail : t.showDetail}
        </Button>
      </div>
      {open ? <QuoteDetail id={quote.id} title={t.version(quote.version)} /> : null}
    </li>
  );
}

function QuoteDetail({ id, title }: { id: string; title: string }) {
  const resource = useResource(useCallback(() => getQuote(id), [id]));
  return (
    <ResourceView resource={resource}>{(quote) => <QuoteView quote={quote} title={title} />}</ResourceView>
  );
}

export function QuoteHistory({ quotes }: { quotes: readonly Quote[] }) {
  if (!quotes.length) return null;
  return (
    <section aria-labelledby="devis-historique" className="grid gap-2">
      <h3 id="devis-historique" className="text-ink font-semibold">
        {t.history}
      </h3>
      <ul className="grid gap-3">
        {[...quotes]
          .sort((a, b) => b.version - a.version)
          .map((quote) => (
            <HistoryItem key={quote.id} quote={quote} />
          ))}
      </ul>
    </section>
  );
}
