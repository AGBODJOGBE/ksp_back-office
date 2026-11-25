'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { apiErrorText } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { type HolderFilter, listWalletPayouts, WALLET_PAYOUT_STATUSES } from '@/features/wallet/requests-api';
import type { WalletPayout } from '@/features/wallet/requests-schemas';
import { operatorName, walletPayoutStatus, walletPayoutTexts as t } from '@/features/wallet/requests-texts';
import { HolderCell, HolderChip, StatusFilter, useListFilters } from './list-filters';

/** Onglet des reversements Mobile Money (service payment), où l'exécution se suit. */
const EXECUTION_PATH = '/finance/reversements';

const COLUMNS: TableColumn<WalletPayout>[] = [
  { key: 'holder', header: t.holder, primary: true, cell: (p) => <HolderCell holder={p.holder} /> },
  {
    key: 'amount',
    header: t.amount,
    className: 'tabular-nums font-semibold',
    cell: (p) => formatXof(p.amount),
  },
  {
    key: 'beneficiary',
    header: t.columns.beneficiary,
    cell: (p) => (
      <span className="grid gap-0.5 tabular-nums">
        <span>{p.beneficiaryPhoneMasked}</span>
        <span className="text-small text-ink-muted">{operatorName(p.beneficiaryOperator)}</span>
      </span>
    ),
  },
  { key: 'created', header: t.columns.created, cell: (p) => formatDateTime(p.createdAt) },
  {
    key: 'progress',
    header: t.columns.progress,
    cell: (p) => {
      const status = walletPayoutStatus(p.status);
      return (
        <span className="grid justify-items-end gap-1 text-right md:justify-items-start md:text-left">
          <Badge tone={status.tone}>{status.label}</Badge>
          {p.completedAt ? (
            <span className="text-small text-ink-muted">{t.completedOn(formatDateTime(p.completedAt))}</span>
          ) : null}
          {p.failedAt ? (
            <span className="text-small text-ink-muted">{t.failedOn(formatDateTime(p.failedAt))}</span>
          ) : null}
          {p.paymentPayoutId ? <span className="text-small text-ink-muted">{t.transmitted}</span> : null}
        </span>
      );
    },
  },
];

function Payouts({ status, holder }: { status?: string; holder?: HolderFilter }) {
  const load = useCallback(
    (cursor?: string) => listWalletPayouts({ status, holder }, cursor),
    [status, holder],
  );
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{status || holder ? t.emptyFiltered : t.empty}</p>}
      labels={t}
    >
      <ResponsiveTable caption={t.caption} columns={COLUMNS} rows={list.items} rowKey={(p) => p.id} />
    </PagedListState>
  );
}

/**
 * Reversements demandés depuis les portefeuilles (lecture seule), filtrés par état et par titulaire
 * dans l'adresse. L'exécution (virement manuel, confirmation, échec) se fait dans l'onglet Reversements.
 */
export function WalletPayoutsList() {
  const { status, holder, setStatus, clearHolder } = useListFilters();
  return (
    <div className="grid gap-5">
      <p className="text-small text-ink-muted">
        {t.execution}{' '}
        <Link href={EXECUTION_PATH} className="text-accent-ink font-semibold underline">
          {t.executionLink}
        </Link>
      </p>
      <HolderChip holder={holder} onClear={clearHolder} />
      <StatusFilter
        id="filtre-etat-reversement-titulaire"
        value={status}
        statuses={WALLET_PAYOUT_STATUSES}
        labelOf={walletPayoutStatus}
        onChange={setStatus}
      />
      <Payouts key={`${status}-${holder?.id}`} status={status} holder={holder} />
    </div>
  );
}
