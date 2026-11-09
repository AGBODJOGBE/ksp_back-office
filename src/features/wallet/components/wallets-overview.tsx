'use client';

import { type FormEvent, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { ResourceView } from '@/components/ui/resource-view';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { apiErrorText, useSession } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import {
  type AccountMatch,
  accountLookupError,
  accountName,
  DEFAULT_COUNTRY_CODE,
  findAccountByPhone,
  toE164,
} from '@/features/identity';
import { walletAccess } from '@/features/wallet/access';
import { getOverview } from '@/features/wallet/api';
import type { WalletOverview } from '@/features/wallet/schemas';
import { internalAccount, walletPaths, walletTexts } from '@/features/wallet/texts';

const t = walletTexts;
const o = walletTexts.overview;
const q = walletTexts.search;

type InternalAccount = WalletOverview['internalAccounts'][number];

const accountColumns: TableColumn<InternalAccount>[] = [
  {
    key: 'account',
    header: o.account,
    primary: true,
    cell: (row) => {
      const { label, hint } = internalAccount(row.account);
      return (
        <span className="grid gap-0.5">
          <span className="text-ink font-semibold">{label}</span>
          {hint ? <span className="text-small text-ink-muted">{hint}</span> : null}
        </span>
      );
    },
  },
  {
    key: 'balance',
    header: o.balance,
    className: 'tabular-nums md:text-right',
    cell: (row) => formatXof(row.balance),
  },
];

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border-line bg-surface-muted grid content-start gap-1 border p-4">
      <dt className="text-small text-ink-muted font-medium">{label}</dt>
      <dd className="font-display text-h3 text-ink font-semibold tabular-nums">{value}</dd>
      {hint ? <dd className="text-small text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

function Overview({ overview }: { overview: WalletOverview }) {
  return (
    <div className="grid gap-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Figure
          label={o.owedToCustomers}
          value={overview.owedToCustomers ? formatXof(overview.owedToCustomers) : o.notAvailable}
          hint={o.owedToCustomersHint}
        />
        <Figure
          label={o.customers}
          value={overview.customersCount === undefined ? o.notAvailable : String(overview.customersCount)}
        />
        <Figure
          label={o.owedToHolders}
          value={formatXof(overview.owedToHolders)}
          hint={o.holders(overview.holdersCount)}
        />
      </dl>
      <div className="grid gap-3">
        <h3 className="text-ink font-semibold">{o.internalTitle}</h3>
        <ResponsiveTable
          caption={o.internalCaption}
          columns={accountColumns}
          rows={overview.internalAccounts}
          rowKey={(row) => row.account}
        />
      </div>
    </div>
  );
}

/** Recherche d'un particulier par son numéro (identity), puis lien vers son portefeuille. */
function PhoneSearch() {
  const [phone, setPhone] = useState('');
  const [match, setMatch] = useState<AccountMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (searching) return;
    const e164 = toE164(DEFAULT_COUNTRY_CODE, phone);
    if (!e164) {
      setError(q.phoneInvalid);
      return;
    }
    setSearching(true);
    setError(null);
    setMatch(null);
    try {
      setMatch(await findAccountByPhone(e164));
    } catch (caught) {
      setError(accountLookupError(caught) ?? apiErrorText(caught));
    } finally {
      setSearching(false);
    }
  }

  if (match) {
    return (
      <div className="grid gap-3">
        <div role="status" className="rounded-card border-line bg-surface-muted grid gap-1 border p-4">
          <p className="text-small text-ink-muted">{q.found}</p>
          <p className="text-ink font-semibold">{accountName(match) ?? q.noName}</p>
          <p className="text-ink-muted tabular-nums">{match.phoneMasked}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink variant="action" href={walletPaths.holder('user', match.userId)}>
            {q.open}
          </ButtonLink>
          <Button variant="ghost" onClick={() => setMatch(null)}>
            {q.other}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={search} className="grid gap-3">
      <TextField
        id="portefeuille-telephone"
        type="tel"
        label={q.phone}
        hint={q.phoneHint}
        autoComplete="off"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={error}
        className="max-w-sm"
      />
      <Button
        type="submit"
        variant="secondary"
        className="justify-self-start"
        aria-busy={searching || undefined}
        disabled={searching || !phone.trim()}
      >
        {searching ? q.searching : q.submit}
      </Button>
    </form>
  );
}

/**
 * Portefeuilles : vue d'ensemble du grand livre (dû aux clients et aux créanciers, comptes internes) et
 * accès au portefeuille d'un client. La recherche par numéro n'est montrée qu'aux rôles qui peuvent
 * l'appeler (identity) ; sinon, l'écran rappelle les autres chemins (paiement, facture, entreprise).
 */
export function WalletsOverview() {
  const resource = useResource(getOverview);
  const roles = useSession()?.roles ?? [];
  const access = walletAccess(roles);
  return (
    <div className="grid gap-6">
      <Panel title={o.title} id="portefeuilles-ensemble">
        <ResourceView resource={resource} lines={4} labels={t} describe={apiErrorText}>
          {(overview) => <Overview overview={overview} />}
        </ResourceView>
      </Panel>
      <Panel title={q.title} id="portefeuilles-recherche">
        {access.searchByPhone ? <PhoneSearch /> : null}
        <p className="text-small text-ink-muted">{q.elsewhere}</p>
      </Panel>
    </div>
  );
}
