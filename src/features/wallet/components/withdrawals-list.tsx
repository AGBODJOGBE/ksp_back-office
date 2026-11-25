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
import { type ListFilters, listWithdrawals, WITHDRAWAL_STATUSES } from '@/features/wallet/requests-api';
import type { Withdrawal } from '@/features/wallet/requests-schemas';
import { operatorName, withdrawalStatus, withdrawalTexts as t } from '@/features/wallet/requests-texts';
import { HolderCell, HolderChip, StatusFilter, useListFilters } from './list-filters';
import { type DecisionHandlers, WithdrawalActions } from './withdrawal-actions';

function Progress({ withdrawal: w, me }: { withdrawal: Withdrawal; me?: string }) {
  const status = withdrawalStatus(w.status);
  const lines = [
    w.processedAt
      ? t.processedBy(formatDateTime(w.processedAt), w.processedBy === me ? t.you : t.colleague)
      : null,
    w.processingNote ? t.note(w.processingNote) : null,
    w.approvedAt ? t.approvedOn(formatDateTime(w.approvedAt)) : null,
    w.completedAt ? t.completedOn(formatDateTime(w.completedAt)) : null,
    w.failedAt ? t.failedOn(formatDateTime(w.failedAt)) : null,
    w.rejectedAt ? t.rejectedOn(formatDateTime(w.rejectedAt)) : null,
    w.rejectionReason ? t.rejection(w.rejectionReason) : null,
  ].filter((line): line is string => Boolean(line));
  return (
    <span className="grid justify-items-end gap-1 text-right md:justify-items-start md:text-left">
      <Badge tone={status.tone}>{status.label}</Badge>
      {lines.map((line) => (
        <span key={line} className="text-small text-ink-muted max-w-xs">
          {line}
        </span>
      ))}
    </span>
  );
}

function columns(handlers: DecisionHandlers | null, me?: string): TableColumn<Withdrawal>[] {
  return [
    {
      key: 'holder',
      header: t.holder,
      primary: true,
      cell: (w) => <HolderCell holder={w.holder} />,
    },
    {
      key: 'amount',
      header: t.amount,
      className: 'tabular-nums font-semibold',
      cell: (w) => formatXof(w.amount),
    },
    {
      key: 'beneficiary',
      header: t.columns.beneficiary,
      cell: (w) => (
        <span className="grid gap-0.5 tabular-nums">
          <span>{w.beneficiaryPhoneMasked}</span>
          <span className="text-small text-ink-muted">{operatorName(w.beneficiaryOperator)}</span>
        </span>
      ),
    },
    { key: 'requested', header: t.columns.requested, cell: (w) => formatDateTime(w.requestedAt) },
    { key: 'progress', header: t.columns.progress, cell: (w) => <Progress withdrawal={w} me={me} /> },
    {
      key: 'action',
      header: t.action,
      cell: (w) => (handlers ? <WithdrawalActions withdrawal={w} handlers={handlers} /> : null),
    },
  ];
}

function Withdrawals({
  filters,
  handlers,
  me,
}: {
  filters: ListFilters;
  handlers: DecisionHandlers | null;
  me?: string;
}) {
  const { status, holder } = filters;
  const load = useCallback(
    (cursor?: string) => listWithdrawals({ status, holder }, cursor),
    [status, holder],
  );
  const list = usePagedList(load, apiErrorText);
  const filtered = Boolean(status || holder);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{filtered ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable
        caption={t.caption}
        columns={columns(handlers, me)}
        rows={list.items}
        rowKey={(w) => w.id}
      />
    </PagedListState>
  );
}

/**
 * File des retraits (R-WL-04), les plus anciens d'abord, filtrée par état et par titulaire dans
 * l'adresse. Chaque décision se prend sur sa ligne, confirmée ; la liste est relue après chacune.
 */
export function WithdrawalsList() {
  const current = useSession();
  const { status, holder, setStatus, clearHolder } = useListFilters();
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
      <HolderChip holder={holder} onClear={clearHolder} />
      <StatusFilter
        id="filtre-etat-retrait"
        value={status}
        statuses={WITHDRAWAL_STATUSES}
        labelOf={withdrawalStatus}
        onChange={(value) => {
          setDone(null);
          setStatus(value);
        }}
      />
      <Withdrawals
        key={`${status}-${holder?.id}-${version}`}
        filters={{ status, holder }}
        handlers={handlers}
        me={current?.user.id}
      />
    </div>
  );
}
