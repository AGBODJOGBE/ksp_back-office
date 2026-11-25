'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import { countAgents, listAgents } from '@/features/cleaning/agents-api';
import {
  agentQuery,
  type AgentFilterValues,
  formatPhone,
  hasAgentFilters,
  readAgentFilters,
  toAgentFilters,
} from '@/features/cleaning/agents-filters';
import type { Agent, AgentStatus } from '@/features/cleaning/agents-schemas';
import {
  agentName,
  agentStatus,
  agentsTexts,
  APPLICATION_STATUSES,
  employmentName,
  formatRating,
} from '@/features/cleaning/agents-texts';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';
import { AgentStatusBadge, communeNames, type References, SkillsInline, useReferences } from './agent-parts';
import { AgentsFilterBar } from './agents-filter-bar';
import { RowLink } from './catalog-parts';
import { ListState, LoadingBlock, Note, useCleaningAccess } from './parts';

const t = agentsTexts.list;
const c = t.columns;

function columns(references: References): TableColumn<Agent>[] {
  return [
    {
      key: 'name',
      header: c.name,
      primary: true,
      cell: (row) => (
        <span className="grid gap-0.5">
          <RowLink href={cleaningPaths.agent(row.id)}>{agentName(row)}</RowLink>
          <span className="text-small text-ink-muted tabular-nums">{formatPhone(row.phone)}</span>
        </span>
      ),
    },
    { key: 'status', header: c.status, cell: (row) => <AgentStatusBadge status={row.status} /> },
    {
      key: 'zones',
      header: c.zones,
      cell: (row) =>
        row.zoneKeys.length ? (
          communeNames(references, row.zoneKeys)
        ) : (
          <span className="text-ink-muted">{t.noZone}</span>
        ),
    },
    { key: 'skills', header: c.skills, cell: (row) => <SkillsInline skills={row.skills} /> },
    { key: 'employment', header: c.employment, cell: (row) => employmentName(row.employmentKind) },
    {
      key: 'rating',
      header: c.rating,
      cell: (row) =>
        row.stats.ratingAverage === null ? (
          <span className="text-ink-muted">{t.noRating}</span>
        ) : (
          <span className="tabular-nums">{formatRating(row.stats.ratingAverage)}</span>
        ),
    },
    { key: 'created', header: c.created, cell: (row) => formatDate(row.createdAt) },
  ];
}

/** Candidatures à traiter, mises en avant : un compteur par statut ; un clic filtre la liste. */
function Applications({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (status: AgentStatus | '') => void;
}) {
  const counts = useResource(
    useCallback(() => Promise.all(APPLICATION_STATUSES.map((status) => countAgents(status))), []),
  );
  const values = counts.state.status === 'ready' ? counts.state.data : null;
  return (
    <section aria-labelledby="agents-a-traiter" className="grid gap-2">
      <h2 id="agents-a-traiter" className="text-ink font-semibold">
        {t.toDo}
      </h2>
      <p className="text-small text-ink-muted">{t.toDoHint}</p>
      <div className="flex flex-wrap gap-2">
        {APPLICATION_STATUSES.map((status, index) => {
          const selected = active === status;
          return (
            <Button
              key={status}
              variant={selected ? 'action' : 'secondary'}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? '' : status)}
            >
              <span>{agentStatus(status).label}</span>
              <span className={cn('tabular-nums', selected ? undefined : 'text-ink-muted')}>
                {values ? values[index] : t.countUnknown}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/** Liste des agents d'un jeu de filtres ; remontée à chaque changement de filtres (`key`). */
function AgentsTable({ values, references }: { values: AgentFilterValues; references: References }) {
  const [total, setTotal] = useState<number | null>(null);
  const filters = useMemo(() => toAgentFilters(values), [values]);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listAgents(filters)(cursor);
      setTotal(page.total);
      return page;
    },
    [filters],
  );
  const list = usePagedList(load, loadErrorText);
  const tableColumns = useMemo(() => columns(references), [references]);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : t.count(total)}
      </p>
      <ListState list={list} empty={<Note>{hasAgentFilters(values) ? t.empty : t.emptyAll}</Note>}>
        <ResponsiveTable
          caption={t.caption}
          columns={tableColumns}
          rows={list.items}
          rowKey={(row) => row.id}
        />
      </ListState>
    </div>
  );
}

/** Agents et candidatures (`/nettoyage/equipe`) : à traiter, filtres dans l'adresse, liste paginée. */
export function AgentsList() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readAgentFilters(new URLSearchParams(query)), [query]);

  if (!access) return <LoadingBlock lines={6} />;
  if (!access['cleaning.planning.manage']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<AgentFilterValues>) => {
    const next = agentQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-6">
      {access['cleaning.agent.manage'] ? (
        <Link
          href={cleaningPaths.newAgent}
          className="text-accent-ink inline-flex min-h-11 items-center justify-self-start font-semibold underline"
        >
          {t.newAgent}
        </Link>
      ) : null}
      <Applications active={values.status} onSelect={(status) => update({ status })} />
      <Filtered values={values} onChange={update} onClear={() => router.replace(pathname)} />
    </div>
  );
}

function Filtered({
  values,
  onChange,
  onClear,
}: {
  values: AgentFilterValues;
  onChange: (changes: Partial<AgentFilterValues>) => void;
  onClear: () => void;
}) {
  const references = useReferences();
  const communes = useMemo(
    () => [...references.communes].map(([value, label]) => ({ value, label })),
    [references],
  );
  const skills = useMemo(
    () => references.skills.map((skill) => ({ value: skill.code, label: skill.name })),
    [references],
  );
  return (
    <div className="grid gap-6">
      <AgentsFilterBar values={values} communes={communes} skills={skills} onChange={onChange} />
      {hasAgentFilters(values) ? (
        <Button variant="ghost" className="justify-self-start" onClick={onClear}>
          {t.clear}
        </Button>
      ) : null}
      <AgentsTable key={JSON.stringify(values)} values={values} references={references} />
    </div>
  );
}
