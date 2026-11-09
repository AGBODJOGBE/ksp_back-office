'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { DescriptionList } from '@/components/ui/description-list';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { PagedListState } from '@/components/ui/paged-list-state';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { ApiError, apiErrorText, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import { isModuleVisible } from '@/lib/navigation/visible-modules';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import { organizationPaths } from '@/features/identity/organizations';
import { walletAccess } from '@/features/wallet/access';
import {
  getHolderWallet,
  type HolderType,
  listStatement,
  type StatementAccount,
} from '@/features/wallet/api';
import type { PrepaidWallet, StatementLine, Wallet } from '@/features/wallet/schemas';
import { objectLabel, statementKind, walletPaths, walletTexts } from '@/features/wallet/texts';
import { CreditDialog } from './credit-dialog';

const t = walletTexts;
const h = walletTexts.holder;
const s = walletTexts.statement;

/** Fiche de l'objet payé (adresses fixées par les fonctionnalités cleaning et billing). */
const OBJECT_PATHS: Record<string, { module: string; path: (id: string) => string }> = {
  cleaning_mission: { module: 'nettoyage', path: (id) => `/nettoyage/missions/${encodeURIComponent(id)}` },
  billing_invoice: { module: 'finance', path: (id) => `/finance/factures/${encodeURIComponent(id)}` },
};

/** Compte du relevé dans l'adresse : `?compte=creancier` pour les fonds dus au créancier. */
const COLLECTIONS_PARAM = 'creancier';

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

function columns(roles: readonly string[]): TableColumn<StatementLine>[] {
  return [
    {
      key: 'operation',
      header: s.operation,
      primary: true,
      cell: (line) => {
        const target = line.object ? OBJECT_PATHS[line.object.objectType] : undefined;
        return (
          <span className="grid gap-0.5">
            <span className="text-ink font-semibold">{statementKind(line.kind)}</span>
            <span className="text-small text-ink-muted">{line.description}</span>
            {line.object ? (
              target && isModuleVisible(target.module, roles) ? (
                <Link
                  href={target.path(line.object.objectId)}
                  className="text-accent-ink text-small font-semibold underline"
                >
                  {objectLabel(line.object)}
                </Link>
              ) : (
                <span className="text-small text-ink-muted">{objectLabel(line.object)}</span>
              )
            ) : null}
          </span>
        );
      },
    },
    { key: 'date', header: s.date, cell: (line) => formatDateTime(line.createdAt) },
    {
      key: 'amount',
      header: s.amount,
      className: 'tabular-nums font-semibold md:text-right',
      cell: (line) =>
        line.direction === 'credit' ? (
          <span className="text-action-ink">{s.credit(formatXof(line.amount))}</span>
        ) : (
          s.debit(formatXof(line.amount))
        ),
    },
    {
      key: 'balanceAfter',
      header: s.balanceAfter,
      className: 'tabular-nums md:text-right',
      cell: (line) => formatXof(line.balanceAfter),
    },
  ];
}

function StatementList({ type, id, account }: { type: HolderType; id: string; account: StatementAccount }) {
  const load = useCallback(
    (cursor?: string) => listStatement(type, id, account, cursor),
    [type, id, account],
  );
  const list = usePagedList(load, apiErrorText);
  const roles = useSession()?.roles ?? [];
  return (
    <PagedListState list={list} empty={<p className="text-small text-ink-muted">{s.empty}</p>} labels={t}>
      <ResponsiveTable
        caption={s.caption}
        columns={columns(roles)}
        rows={list.items}
        rowKey={(line) => line.transactionId}
      />
    </PagedListState>
  );
}

/** Le titulaire a-t-il des fonds de créancier (ADR-042) ? Sinon, seul le portefeuille prépayé est montré. */
const hasCollections = (wallet: Wallet) =>
  wallet.lastEntryAt !== null ||
  wallet.balance.amount !== 0 ||
  wallet.payoutsInProgress.amount !== 0 ||
  wallet.totalCollected.amount !== 0;

function HolderView({
  type,
  id,
  wallet,
  onPrepaid,
}: {
  type: HolderType;
  id: string;
  wallet: Wallet;
  onPrepaid: (prepaid: PrepaidWallet) => void;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const roles = useSession()?.roles ?? [];
  const access = walletAccess(roles);
  const [done, setDone] = useState<string | null>(null);
  // Relecture du relevé après un crédit.
  const [version, setVersion] = useState(0);
  const collections = hasCollections(wallet);
  const account: StatementAccount =
    collections && params.get('compte') === COLLECTIONS_PARAM ? 'collections' : 'prepaid';
  const prepaid = wallet.prepaid;
  const title = type === 'organization' ? h.organization : h.user;

  function chooseAccount(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'collections') next.set('compte', COLLECTIONS_PARAM);
    else next.delete('compte');
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <BackLink href={walletPaths.overview}>{h.back}</BackLink>
        <Heading as="h1" size="h2">
          {title}
        </Heading>
        <p className="text-small text-ink-muted break-all">{h.identifier(id)}</p>
        {type === 'organization' && isModuleVisible('clients', roles) ? (
          <Link
            href={organizationPaths.organization(id)}
            className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
          >
            {h.seeOrganization}
          </Link>
        ) : null}
      </div>

      <FormMessage tone="success">{done}</FormMessage>

      <div className={collections ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
        <Panel
          title={h.prepaidTitle}
          id="portefeuille-prepaye"
          action={
            access.wallets ? (
              <CreditDialog
                type={type}
                holderId={id}
                holderLabel={`${title} · ${id}`}
                onCredited={(credit) => {
                  const amount = formatXof(credit.amount);
                  const balance = formatXof(credit.wallet.balance);
                  setDone(credit.created ? t.credit.done(amount, balance) : t.credit.already(balance));
                  onPrepaid(credit.wallet);
                  setVersion((value) => value + 1);
                }}
              />
            ) : null
          }
        >
          <p className="text-small text-ink-muted">{h.prepaidHint}</p>
          <DescriptionList
            items={[
              {
                term: h.balance,
                value: (
                  <span className="font-display text-h3 font-semibold tabular-nums">
                    {formatXof(prepaid?.balance ?? 0)}
                  </span>
                ),
              },
              {
                term: h.lastEntry,
                value: prepaid?.lastEntryAt ? formatDateTime(prepaid.lastEntryAt) : h.noEntry,
              },
            ]}
          />
        </Panel>

        {collections ? (
          <Panel title={h.collectionsTitle} id="portefeuille-creancier">
            <p className="text-small text-ink-muted">{h.collectionsHint}</p>
            <DescriptionList
              items={[
                {
                  term: h.available,
                  value: <strong className="tabular-nums">{formatXof(wallet.balance)}</strong>,
                },
                { term: h.inProgress, value: formatXof(wallet.payoutsInProgress) },
                { term: h.collected, value: formatXof(wallet.totalCollected) },
                { term: h.paidOut, value: formatXof(wallet.totalPaidOut) },
              ]}
            />
          </Panel>
        ) : null}
      </div>

      <Panel title={s.title} id="portefeuille-releve">
        {collections ? (
          <SelectField
            id="releve-compte"
            label={s.account}
            value={account}
            className="w-full sm:max-w-xs"
            onChange={(event) => chooseAccount(event.target.value)}
          >
            <option value="prepaid">{s.prepaid}</option>
            <option value="collections">{s.collections}</option>
          </SelectField>
        ) : null}
        <StatementList key={`${account}-${version}`} type={type} id={id} account={account} />
      </Panel>
    </div>
  );
}

/**
 * Portefeuille d'un titulaire (particulier ou entreprise) : solde prépayé, fonds de créancier s'il en a,
 * relevé paginé (compte choisi dans l'adresse, `?compte=creancier`) et crédit manuel par la finance.
 */
export function HolderWallet({ type, id }: { type: HolderType; id: string }) {
  const resource = useResource(useCallback(() => getHolderWallet(type, id), [type, id]));
  return (
    <ResourceView
      resource={resource}
      lines={6}
      labels={t}
      describe={(error) => (isNotFound(error) ? h.notFound : apiErrorText(error))}
      retryable={(error) => !isNotFound(error)}
    >
      {(wallet) => (
        <HolderView
          type={type}
          id={id}
          wallet={wallet}
          onPrepaid={(prepaid) => resource.set({ ...wallet, prepaid })}
        />
      )}
    </ResourceView>
  );
}
