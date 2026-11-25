'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import { countClaims, listClaims } from '@/features/cleaning/claims-api';
import {
  claimQuery,
  type ClaimFilterValues,
  hasClaimFilters,
  readClaimFilters,
  toClaimApiFilters,
} from '@/features/cleaning/claims-filters';
import type { Claim } from '@/features/cleaning/claims-schemas';
import {
  claimCategory,
  claimCustomer,
  claimNextStep,
  claimStatus,
  claimsTexts,
  responseLate,
} from '@/features/cleaning/claims-texts';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { RowLink } from './catalog-parts';
import { ClaimsFilterBar } from './claims-filter-bar';
import { ListState, LoadingBlock, Note, useCleaningAccess } from './parts';

const t = claimsTexts.list;
const c = t.columns;

/** Signal « plus de 24 h sans réponse » (objectif de première réponse du contrat). */
export function LateBadge({ claim, now }: { claim: Claim; now: number }) {
  return responseLate(claim, now) ? <Badge tone="danger">{t.late}</Badge> : null;
}

function columnsAt(now: number): TableColumn<Claim>[] {
  return [
    {
      key: 'claim',
      header: c.claim,
      primary: true,
      cell: (row) => (
        <RowLink href={cleaningPaths.claim(row.id)}>
          {claimsTexts.detail.heading(claimCategory(row.category))}
        </RowLink>
      ),
    },
    {
      key: 'customer',
      header: c.customer,
      cell: (row) => {
        const name = claimCustomer(row);
        return <span className={name ? undefined : 'text-ink-muted'}>{name ?? t.noName}</span>;
      },
    },
    {
      key: 'status',
      header: c.status,
      cell: (row) => {
        const status = claimStatus(row.status);
        return (
          <span className="grid justify-items-start gap-1">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            <LateBadge claim={row} now={now} />
          </span>
        );
      },
    },
    {
      key: 'next',
      header: c.next,
      cell: (row) => {
        const step = claimNextStep(row);
        return (
          <span className={step.action ? 'text-ink font-semibold' : 'text-ink-muted'}>{step.label}</span>
        );
      },
    },
    { key: 'opened', header: c.opened, cell: (row) => formatDateTime(row.openedAt) },
  ];
}

/** Compteurs « Nouvelles » et « En cours » : un clic filtre la file. */
function Watch({ status, onSelect }: { status: string; onSelect: (status: string) => void }) {
  const counts = useResource(
    useCallback(
      () => Promise.all([countClaims({ status: 'open' }), countClaims({ status: 'in_progress' })]),
      [],
    ),
  );
  const [open, inProgress] = counts.state.status === 'ready' ? counts.state.data : [null, null];
  const items = [
    { code: 'open', label: t.open, value: open },
    { code: 'in_progress', label: t.inProgress, value: inProgress },
  ];
  return (
    <section aria-labelledby="reclamations-a-traiter" className="grid gap-2">
      <h2 id="reclamations-a-traiter" className="text-ink font-semibold">
        {t.toDo}
      </h2>
      <p className="text-small text-ink-muted">{t.toDoHint}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = status === item.code;
          return (
            <Button
              key={item.code}
              variant={active ? 'action' : 'secondary'}
              aria-pressed={active}
              onClick={() => onSelect(active ? '' : item.code)}
            >
              <span>{item.label}</span>
              <span className={cn('tabular-nums', active ? undefined : 'text-ink-muted')}>
                {item.value ?? t.countUnknown}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/** File d'un jeu de filtres ; remontée à chaque changement de filtres (`key`). */
function ClaimsTable({ values }: { values: ClaimFilterValues }) {
  const [total, setTotal] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const filters = useMemo(() => toClaimApiFilters(values), [values]);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listClaims(filters)(cursor);
      setTotal(page.total);
      return page;
    },
    [filters],
  );
  const list = usePagedList(load, loadErrorText);
  const columns = useMemo(() => columnsAt(now), [now]);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : t.total(total)}
      </p>
      <ListState list={list} empty={<Note>{hasClaimFilters(values) ? t.empty : t.emptyAll}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(row) => row.id} />
      </ListState>
    </div>
  );
}

/**
 * File des réclamations (`/nettoyage/reclamations`) : compteurs de ce qui attend une action, filtres dans
 * l'adresse, file paginée (plus anciennes d'abord par défaut, comme le contrat).
 */
export function ClaimsQueue() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readClaimFilters(new URLSearchParams(query)), [query]);

  if (!access) return <LoadingBlock lines={6} />;
  if (!access['cleaning.claim.manage']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<ClaimFilterValues>) => {
    const next = claimQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <Watch status={values.status} onSelect={(status) => update({ status })} />
      <ClaimsFilterBar values={values} onChange={update} />
      {values.customerId ? <Note>{t.customerFilter}</Note> : null}
      {values.organizationId ? <Note>{t.organizationFilter}</Note> : null}
      {hasClaimFilters(values) ? (
        <Button variant="ghost" className="justify-self-start" onClick={() => router.replace(pathname)}>
          {t.clear}
        </Button>
      ) : null}
      <ClaimsTable key={JSON.stringify(values)} values={values} />
    </div>
  );
}
