'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { formatDate, formatDateTime, formatXof } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { readCaseFilters } from '@/features/recovery/case-logic';
import { caseListTexts } from '@/features/recovery/case-list-texts';
import { caseStatusTone } from '@/features/recovery/case-texts';
import { listCases } from '@/features/recovery/cases-api';
import { loadErrorText } from '@/features/recovery/errors';
import { CASE_PARAMS, type CaseFilterKey, recoveryPaths } from '@/features/recovery/paths';
import type { CaseSummary } from '@/features/recovery/schemas';
import { actorName, caseStatusLabel, deadlineLabel, kindLabel, stageLabel } from '@/features/recovery/texts';
import { CasesFilterBar, PriorityLinks } from './cases-filter-bar';
import { ListState, Note, useSessionUserId } from './parts';

const t = caseListTexts;
const DAY = 86_400_000;

/** Jours écoulés depuis une date (arrondi à l'unité inférieure). */
const daysSince = (iso: string, now: number) =>
  Math.max(Math.floor((now - new Date(iso).getTime()) / DAY), 0);

function columns(now: number): TableColumn<CaseSummary>[] {
  return [
    {
      key: 'number',
      header: t.columns.number,
      primary: true,
      cell: (item) => (
        <span className="grid gap-0.5">
          <Link
            href={recoveryPaths.case(item.id)}
            aria-label={t.open(item.number)}
            className="text-accent-ink stretched-link font-semibold underline-offset-4 hover:underline"
          >
            {item.number}
          </Link>
          <span>{item.debtorName}</span>
          <span className="text-small text-ink-muted">{kindLabel(item.kind)}</span>
        </span>
      ),
    },
    { key: 'creditor', header: t.columns.creditor, cell: (item) => item.creditor.displayName },
    {
      key: 'status',
      header: t.columns.status,
      cell: (item) => (
        <span className="grid justify-items-start gap-1">
          <Badge tone={caseStatusTone(item.status)} dot>
            {item.status === 'under_review' ? t.toReview : caseStatusLabel(item.status)}
          </Badge>
          {item.stage ? <span className="text-small">{stageLabel(item.stage)}</span> : null}
          {item.score !== null ? (
            <span className="text-small text-ink-muted">{t.score(item.score)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'amounts',
      header: t.columns.amounts,
      cell: (item) => (
        <span className="grid gap-0.5 tabular-nums">
          <span className="font-semibold">{formatXof(item.due)}</span>
          <span className="text-small text-ink-muted">{t.paid(formatXof(item.paid))}</span>
        </span>
      ),
    },
    {
      key: 'deadline',
      header: t.columns.deadline,
      cell: (item) => {
        const deadline = item.nextDeadline;
        if (!deadline) return <span className="text-ink-muted">{t.noDeadline}</span>;
        const late = new Date(deadline.dueAt).getTime() < now;
        return (
          <span className="grid justify-items-start gap-0.5">
            <span>{deadlineLabel(deadline.kind)}</span>
            <span className="text-small">{formatDateTime(deadline.dueAt)}</span>
            {late ? <Badge tone="danger">{t.overdue}</Badge> : null}
            {deadline.kind === 'prescription' && !late ? (
              <Badge tone="warning">{deadlineLabel('prescription')}</Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'agent',
      header: t.columns.agent,
      cell: (item) =>
        item.assignedAgent ? (
          actorName(item.assignedAgent)
        ) : (
          <span className="text-ink-muted">{t.unassigned}</span>
        ),
    },
    {
      key: 'last',
      header: t.columns.lastAction,
      cell: (item) =>
        item.lastActionAt ? (
          <span className="grid gap-0.5">
            <span>{formatDate(item.lastActionAt)}</span>
            <span className="text-small text-ink-muted">{t.idleFor(daysSince(item.lastActionAt, now))}</span>
          </span>
        ) : (
          <span className="text-ink-muted">{t.never}</span>
        ),
    },
  ];
}

/**
 * File des dossiers (`GET /recovery/cases`) : filtres du contrat lus dans l'adresse (`CASE_PARAMS`, ceux
 * que le tableau de bord émet), raccourcis vers ce qui attend une action, total, « Afficher plus ».
 */
export function CasesList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const userId = useSessionUserId();
  const filters = useMemo(() => readCaseFilters(params), [params]);
  // Une recherche arrivée par l'adresse est reprise, puis gardée dans l'écran seulement.
  const [search, setSearch] = useState(() => String(filters.search ?? ''));
  const [total, setTotal] = useState<number | null>(null);
  const query = useMemo(() => ({ ...filters, search: search || undefined }), [filters, search]);
  const key = JSON.stringify(query);
  const load = useMemo(() => {
    const read = listCases(JSON.parse(key));
    return async (cursor?: string) => {
      const page = await read(cursor);
      setTotal(page.total);
      return page;
    };
  }, [key]);
  const list = usePagedList(load, loadErrorText);
  const [now] = useState(() => Date.now());

  const setParam = (name: CaseFilterKey, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete(CASE_PARAMS.search);
    if (value) next.set(CASE_PARAMS[name], value);
    else next.delete(CASE_PARAMS[name]);
    const searchText = next.toString();
    router.replace(searchText ? `${pathname}?${searchText}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <PriorityLinks filters={filters} userId={userId} />
      <CasesFilterBar filters={filters} onChange={setParam} search={search} onSearch={setSearch} />
      <p className="text-small text-ink-muted" role="status">
        {total !== null && !list.loading ? t.count(total) : ''}
      </p>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={columns(now)}
          rows={list.items}
          rowKey={(item) => item.id}
        />
      </ListState>
    </div>
  );
}
