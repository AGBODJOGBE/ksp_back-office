'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { listTeams } from '@/features/cleaning/agents-api';
import type { Team } from '@/features/cleaning/agents-schemas';
import { agentName } from '@/features/cleaning/agents-texts';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { teamsTexts } from '@/features/cleaning/teams-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { RowLink } from './catalog-parts';
import { ActiveBadge, ListState, LoadingBlock, Note, useCleaningAccess } from './parts';

const t = teamsTexts.list;
const c = t.columns;

/** Filtre « état » de l'adresse (`?etat=actives|desactivees`) → `active` du contrat. */
const STATES = { actives: true, desactivees: false } as const;
type StateParam = keyof typeof STATES;
const readState = (value: string | null): StateParam | '' =>
  value === 'actives' || value === 'desactivees' ? value : '';

/** Chef d'équipe lu parmi les membres (absent : identifiant inconnu de la liste). */
export const leadOf = (team: Team) => team.members.find((member) => member.agentId === team.leadAgentId);

const columns: TableColumn<Team>[] = [
  {
    key: 'name',
    header: c.name,
    primary: true,
    cell: (row) => <RowLink href={cleaningPaths.teamDetail(row.id)}>{row.name}</RowLink>,
  },
  {
    key: 'lead',
    header: c.lead,
    cell: (row) => {
      const lead = leadOf(row);
      return lead ? agentName(lead) : <span className="text-ink-muted">—</span>;
    },
  },
  {
    key: 'members',
    header: c.members,
    cell: (row) => (
      <span className="grid gap-0.5">
        <span className="tabular-nums">{t.members(row.members.length)}</span>
        <span className="text-small text-ink-muted">{row.members.map(agentName).join(', ')}</span>
      </span>
    ),
  },
  { key: 'state', header: c.state, cell: (row) => <ActiveBadge active={row.active} feminine /> },
  { key: 'created', header: c.created, cell: (row) => formatDate(row.createdAt) },
];

function TeamsTable({ state }: { state: StateParam | '' }) {
  const [total, setTotal] = useState<number | null>(null);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listTeams(state ? { active: STATES[state] } : {})(cursor);
      setTotal(page.total);
      return page;
    },
    [state],
  );
  const list = usePagedList(load, loadErrorText);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : t.count(total)}
      </p>
      <ListState list={list} empty={<Note>{state ? t.empty : t.emptyAll}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(row) => row.id} />
      </ListState>
    </div>
  );
}

/** Équipes (`/nettoyage/equipe/equipes`) : actives et désactivées, triées par nom. */
export function TeamsList() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = readState(params.get('etat'));

  if (!access) return <LoadingBlock lines={6} />;
  if (!access['cleaning.planning.manage']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  return (
    <div className="grid gap-6">
      {access['cleaning.agent.manage'] ? (
        <Link
          href={cleaningPaths.newTeam}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {t.newTeam}
        </Link>
      ) : null}
      <SelectField
        id="equipes-etat"
        label={t.filter}
        value={state}
        className="max-w-xs"
        onChange={(event) =>
          router.replace(event.target.value ? `${pathname}?etat=${event.target.value}` : pathname)
        }
      >
        <option value="">{t.all}</option>
        <option value="actives">{t.active}</option>
        <option value="desactivees">{t.inactive}</option>
      </SelectField>
      <TeamsTable key={state} state={state} />
    </div>
  );
}
