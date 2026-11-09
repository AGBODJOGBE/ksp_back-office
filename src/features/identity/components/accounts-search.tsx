'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { apiErrorText } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { searchAccounts } from '@/features/identity/account-admin-api';
import type { AdminAccount } from '@/features/identity/account-admin-schemas';
import {
  accountPaths,
  accountStatus,
  accountTexts,
  personName,
  roleLabel,
} from '@/features/identity/account-admin-texts';

const t = accountTexts.list;
const common = accountTexts.common;

export function AccountStatusBadge({ status }: { status: string }) {
  const { label, tone } = accountStatus(status);
  return <Badge tone={tone}>{label}</Badge>;
}

const columns: TableColumn<AdminAccount>[] = [
  {
    key: 'name',
    header: t.columns.name,
    primary: true,
    cell: (account) => (
      <Link href={accountPaths.account(account.userId)} className="stretched-link hover:underline">
        {personName(account) ?? common.unnamed}
      </Link>
    ),
  },
  {
    key: 'phone',
    header: t.columns.phone,
    className: 'tabular-nums',
    cell: (account) => account.phone ?? account.phoneMasked ?? common.noPhone,
  },
  {
    key: 'status',
    header: t.columns.status,
    cell: (account) => <AccountStatusBadge status={account.status} />,
  },
  {
    key: 'roles',
    header: t.columns.roles,
    cell: (account) =>
      account.roles.length ? account.roles.map((code) => roleLabel(code)).join(', ') : t.noRole,
  },
  { key: 'createdAt', header: t.columns.createdAt, cell: (account) => formatDate(account.createdAt) },
];

function Results({ query }: { query: string }) {
  const load = useCallback((cursor?: string) => searchAccounts(query, cursor), [query]);
  const list = usePagedList(load, apiErrorText);
  return (
    <PagedListState
      list={list}
      empty={<p className="text-small text-ink-muted">{query ? t.emptySearch : t.empty}</p>}
      labels={common}
    >
      <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(a) => a.userId} />
    </PagedListState>
  );
}

/**
 * Recherche de comptes (nom ou numéro complet). La recherche reste dans la page, pas dans l'adresse :
 * un numéro de téléphone n'a pas à finir dans l'historique du navigateur.
 */
export function AccountsSearch() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim().replace(/\s+/g, ' '));
  }

  return (
    <div className="grid gap-6">
      <form role="search" onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <TextField
          id="recherche-compte"
          label={t.searchLabel}
          hint={t.searchHint}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          autoComplete="off"
          className="min-w-0 flex-1 basis-64"
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit">{t.search}</Button>
          {query ? (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft('');
                setQuery('');
              }}
            >
              {t.clear}
            </Button>
          ) : null}
        </div>
      </form>
      <section aria-labelledby="comptes-resultats" className="grid gap-4">
        <Heading as="h2" size="h3" id="comptes-resultats">
          {query ? t.resultsTitle(query) : t.teamTitle}
        </Heading>
        <Results key={query || 'equipe'} query={query} />
      </section>
    </div>
  );
}
