'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DescriptionList } from '@/components/ui/description-list';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDateTime } from '@/lib/format';
import type { Comparison } from '@/features/cleaning/requests-schemas';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import { PricingSummary } from './request-pricing';
import { RetainedForm } from './request-retained-form';
import { scalarText, type StepProps, StepSection } from './request-parts';
import { Amount, Note } from './parts';

const t = retainedTexts;
type Row = Comparison['rows'][number];

const columns: TableColumn<Row>[] = [
  {
    key: 'parameter',
    header: t.columns.parameter,
    primary: true,
    cell: (row) => `${row.label}${row.unit ? ` (${row.unit})` : ''}`,
  },
  {
    key: 'declared',
    header: t.columns.declared,
    cell: (row) => row.declaredDisplay ?? scalarText(row.declared),
  },
  {
    key: 'observed',
    header: t.columns.observed,
    cell: (row) => row.observedDisplay ?? scalarText(row.observed),
  },
  {
    key: 'retained',
    header: t.columns.retained,
    cell: (row) => row.retainedDisplay ?? scalarText(row.retained),
  },
  {
    key: 'effect',
    header: t.columns.effect,
    cell: (row) => (row.priceEffect === null ? '—' : <Amount value={row.priceEffect} />),
  },
  { key: 'reason', header: t.columns.reason, cell: (row) => row.reason ?? '—' },
];

/** Déclaré, constaté, retenu (R-CS-02) : écarts par paramètre, types ajoutés ou retirés, prix. */
export function ComparisonView({ comparison }: { comparison: Comparison }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-ink font-semibold">{t.comparison}</h3>
        {comparison.confirmed ? <Badge tone="success">{t.confirmed}</Badge> : null}
      </div>
      {comparison.rows.length ? (
        <ResponsiveTable
          caption={t.comparisonCaption}
          columns={columns}
          rows={comparison.rows}
          rowKey={(row) => row.parameterCode}
        />
      ) : null}
      <DescriptionList
        items={[
          { term: t.added, value: comparison.addedCleaningTypes.map((type) => type.name).join(', ') || null },
          {
            term: t.removed,
            value: comparison.removedCleaningTypes.map((type) => type.name).join(', ') || null,
          },
          {
            term: t.declaredPrice,
            value:
              comparison.declaredSessionPrice === null ? null : (
                <Amount value={comparison.declaredSessionPrice} />
              ),
          },
          {
            term: t.retainedPrice,
            value:
              comparison.retainedSessionPrice === null ? null : (
                <Amount value={comparison.retainedSessionPrice} />
              ),
          },
        ]}
      />
    </div>
  );
}

/** Étape 3 « Version retenue » : comparaison, version enregistrée, ajustement avec estimation. */
export function RequestRetained(props: StepProps) {
  const { request, access } = props;
  const { retained } = request;
  const [editing, setEditing] = useState(false);
  const editable =
    access['cleaning.quote.manage'] && (request.status === 'visit_done' || request.status === 'quote_sent');
  const labels = new Map(request.declaredRows.map((row) => [row.code, row.label]));
  return (
    <StepSection
      step="retained"
      title={t.title}
      action={
        editable && !editing ? (
          <Button variant={retained ? 'secondary' : 'action'} onClick={() => setEditing(true)}>
            {t.edit}
          </Button>
        ) : null
      }
    >
      <p className="text-small text-ink-muted">{t.lead}</p>
      {request.comparison ? <ComparisonView comparison={request.comparison} /> : null}
      {retained ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink">{t.revision(retained.revision, formatDateTime(retained.updatedAt))}</p>
            {retained.locked ? <Badge tone="neutral">{t.locked}</Badge> : null}
          </div>
          <DescriptionList
            items={[
              { term: t.types, value: retained.cleaningTypes.map((type) => type.name).join(', ') },
              ...Object.entries(retained.values).map(([code, value]) => ({
                term: labels.get(code) ?? code,
                value: scalarText(value),
              })),
              ...retained.reasons.map((reason, index) => ({
                term: `${t.columns.reason} ${index + 1}`,
                value: reason.reason,
              })),
              { term: t.reason, value: retained.reason },
            ]}
          />
          <PricingSummary pricing={retained.pricing} />
        </div>
      ) : (
        <Note>{request.visits.some((visit) => visit.status === 'completed') ? t.none : t.waiting}</Note>
      )}
      {editable && editing ? <RetainedForm {...props} onClose={() => setEditing(false)} /> : null}
    </StepSection>
  );
}
