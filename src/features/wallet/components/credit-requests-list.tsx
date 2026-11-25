'use client';

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { FormMessage } from '@/components/ui/field';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { apiErrorText, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { walletAccess } from '@/features/wallet/access';
import { CREDIT_REQUEST_STATUSES, listCreditRequests } from '@/features/wallet/requests-api';
import type { ManualCredit } from '@/features/wallet/requests-schemas';
import { creditKind, creditRequestStatus, creditRequestTexts as t } from '@/features/wallet/requests-texts';
import { CreditRequestActions } from './credit-request-actions';
import { HolderCell, StatusFilter, useListFilters } from './list-filters';
import type { DecisionHandlers } from './withdrawal-actions';

function Detail({ request: r }: { request: ManualCredit }) {
  const status = creditRequestStatus(r.status);
  const lines = [
    r.receiptReference ? t.receipt(r.receiptReference) : null,
    r.approvedAt ? t.approvedOn(formatDateTime(r.approvedAt)) : null,
    r.rejectedAt ? t.rejectedOn(formatDateTime(r.rejectedAt)) : null,
    r.rejectionReason ? t.rejection(r.rejectionReason) : null,
  ].filter((line): line is string => Boolean(line));
  return (
    <span className="grid justify-items-end gap-1 text-right md:justify-items-start md:text-left">
      <Badge tone={status.tone}>{status.label}</Badge>
      <span className="text-small max-w-xs">{r.reason}</span>
      {lines.map((line) => (
        <span key={line} className="text-small text-ink-muted max-w-xs">
          {line}
        </span>
      ))}
    </span>
  );
}

function columns(handlers: DecisionHandlers | null, me?: string): TableColumn<ManualCredit>[] {
  return [
    { key: 'holder', header: t.holder, primary: true, cell: (r) => <HolderCell holder={r.holder} /> },
    {
      key: 'amount',
      header: t.amount,
      className: 'tabular-nums font-semibold',
      cell: (r) => formatXof(r.amount),
    },
    { key: 'kind', header: t.columns.kind, cell: (r) => creditKind(r.kind) },
    {
      key: 'requested',
      header: t.columns.requested,
      cell: (r) => t.requestedBy(formatDateTime(r.requestedAt), r.requestedBy === me ? t.you : t.colleague),
    },
    { key: 'detail', header: t.columns.detail, cell: (r) => <Detail request={r} /> },
    {
      key: 'action',
      header: t.action,
      cell: (r) => (handlers ? <CreditRequestActions request={r} handlers={handlers} /> : null),
    },
  ];
}

function Requests({
  status,
  handlers,
  me,
}: {
  status?: string;
  handlers: DecisionHandlers | null;
  me?: string;
}) {
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listCreditRequests(status, cursor);
      return { data: page.items, nextCursor: page.nextCursor };
    },
    [status],
  );
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{status ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable
        caption={t.caption}
        columns={columns(handlers, me)}
        rows={list.items}
        rowKey={(r) => r.id}
      />
    </PagedListState>
  );
}

/**
 * Demandes de crédit manuel au-delà du seuil (ADR-048), les plus récentes d'abord, filtrées par état
 * dans l'adresse. Validation par un autre membre de la finance que l'auteur, ou rejet motivé, sur la
 * ligne ; la liste est relue après chaque décision.
 */
export function CreditRequestsList() {
  const current = useSession();
  const { status, setStatus } = useListFilters();
  const [done, setDone] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((value) => value + 1);
  const handlers: DecisionHandlers | null =
    current && walletAccess(current.roles).wallets
      ? {
          onDone: (message) => {
            setDone(message);
            refresh();
          },
          onStale: refresh,
        }
      : null;

  return (
    <div className="grid gap-5">
      <FormMessage tone="success">{done}</FormMessage>
      <StatusFilter
        id="filtre-etat-demande-credit"
        value={status}
        statuses={CREDIT_REQUEST_STATUSES}
        labelOf={creditRequestStatus}
        onChange={(value) => {
          setDone(null);
          setStatus(value);
        }}
      />
      <Requests key={`${status}-${version}`} status={status} handlers={handlers} me={current?.user.id} />
    </div>
  );
}
