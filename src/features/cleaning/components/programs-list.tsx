'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { usePagedList } from '@/lib/use-paged-list';
import { useResource } from '@/lib/use-resource';
import { loadErrorText } from '@/features/cleaning/errors';
import { cleaningPaths } from '@/features/cleaning/paths';
import { countPrograms, listPrograms } from '@/features/cleaning/programs-api';
import {
  hasProgramFilters,
  type ProgramFilterValues,
  programQuery,
  readProgramFilters,
  toProgramApiFilters,
} from '@/features/cleaning/programs-filters';
import type { Program } from '@/features/cleaning/programs-schemas';
import {
  hasUnpaid,
  payerKindName,
  programNextStep,
  programStatus,
  programsTexts,
} from '@/features/cleaning/programs-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { RowLink } from './catalog-parts';
import { ListState, LoadingBlock, Note, useCleaningAccess } from './parts';
import { ProgramsFilterBar } from './programs-filter-bar';

const t = programsTexts.list;
const c = t.columns;

/** Client du programme : organisation ou particulier, nom lu dans identity. */
export function customerOf(program: Pick<Program, 'customerKind' | 'customerName' | 'organizationName'>) {
  const name = program.customerKind === 'organization' ? program.organizationName : program.customerName;
  return name?.trim() || null;
}

/** Signaux qui demandent une action : arrêt à valider, impayés (causes de suspension). */
export function ProgramFlags({ program }: { program: Program }) {
  const unpaid = hasUnpaid(program);
  if (!program.pendingCancellation && !unpaid) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {program.pendingCancellation ? <Badge tone="warning">Arrêt à valider</Badge> : null}
      {unpaid ? <Badge tone="danger">Impayés</Badge> : null}
    </span>
  );
}

const columns: TableColumn<Program>[] = [
  {
    key: 'number',
    header: c.number,
    primary: true,
    cell: (row) => <RowLink href={cleaningPaths.program(row.id)}>{row.number}</RowLink>,
  },
  {
    key: 'customer',
    header: c.customer,
    cell: (row) => {
      const name = customerOf(row);
      return (
        <span className="grid gap-0.5">
          <span className={name ? undefined : 'text-ink-muted'}>{name ?? t.noName}</span>
          <span className="text-small text-ink-muted">{payerKindName(row.payerKind)}</span>
        </span>
      );
    },
  },
  {
    key: 'place',
    header: c.place,
    cell: (row) => (
      <span className="grid gap-0.5">
        <span>{row.place.placeTypeName}</span>
        <span className="text-small text-ink-muted">{row.place.communeName}</span>
      </span>
    ),
  },
  { key: 'types', header: c.types, cell: (row) => row.cleaningTypes.map((type) => type.name).join(', ') },
  {
    key: 'progress',
    header: c.progress,
    cell: (row) => (
      <span className="tabular-nums">{t.progress(row.sessionsCompleted, row.sessionsCount)}</span>
    ),
  },
  {
    key: 'status',
    header: c.status,
    cell: (row) => {
      const status = programStatus(row.status);
      return (
        <span className="grid justify-items-start gap-1">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <ProgramFlags program={row} />
        </span>
      );
    },
  },
  {
    key: 'next',
    header: c.next,
    cell: (row) => {
      const step = programNextStep(row);
      return <span className={step.action ? 'text-ink font-semibold' : 'text-ink-muted'}>{step.label}</span>;
    },
  },
  { key: 'created', header: c.created, cell: (row) => formatDate(row.createdAt) },
];

/** Compteur « Suspendus » : un clic filtre la liste (seul signal que le contrat permet de compter). */
function Watch({ active, onSelect }: { active: boolean; onSelect: (selected: boolean) => void }) {
  const count = useResource(useCallback(() => countPrograms({ status: 'suspended' }), []));
  const value = count.state.status === 'ready' ? count.state.data : null;
  return (
    <section aria-labelledby="programmes-a-surveiller" className="grid gap-2">
      <h2 id="programmes-a-surveiller" className="text-ink font-semibold">
        {t.toDo}
      </h2>
      <p className="text-small text-ink-muted">{t.toDoHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={active ? 'action' : 'secondary'}
          aria-pressed={active}
          onClick={() => onSelect(!active)}
        >
          <span>{t.suspended}</span>
          <span className={cn('tabular-nums', active ? undefined : 'text-ink-muted')}>
            {value ?? t.countUnknown}
          </span>
        </Button>
      </div>
    </section>
  );
}

/** Liste des programmes d'un jeu de filtres ; remontée à chaque changement de filtres (`key`). */
function ProgramsTable({ values }: { values: ProgramFilterValues }) {
  const [total, setTotal] = useState<number | null>(null);
  const filters = useMemo(() => toProgramApiFilters(values), [values]);
  const load = useCallback(
    async (cursor?: string) => {
      const page = await listPrograms(filters)(cursor);
      setTotal(page.total);
      return page;
    },
    [filters],
  );
  const list = usePagedList(load, loadErrorText);
  return (
    <div className="grid gap-3">
      <p className="text-small text-ink-muted" aria-live="polite">
        {total === null ? '' : t.total(total)}
      </p>
      <ListState list={list} empty={<Note>{hasProgramFilters(values) ? t.empty : t.emptyAll}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(row) => row.id} />
      </ListState>
    </div>
  );
}

/** Programmes (`/nettoyage/programmes`) : à surveiller, filtres dans l'adresse, liste paginée. */
export function ProgramsList() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readProgramFilters(new URLSearchParams(query)), [query]);

  if (!access) return <LoadingBlock lines={6} />;
  if (!access['cleaning.program.read']) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<ProgramFilterValues>) => {
    const next = programQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <Watch
        active={values.status === 'suspended'}
        onSelect={(selected) => update({ status: selected ? 'suspended' : '' })}
      />
      <ProgramsFilterBar values={values} onChange={update} />
      {values.customerId ? <Note>{t.customerFilter}</Note> : null}
      {values.organizationId ? <Note>{t.organizationFilter}</Note> : null}
      {hasProgramFilters(values) ? (
        <Button variant="ghost" className="justify-self-start" onClick={() => router.replace(pathname)}>
          {t.clear}
        </Button>
      ) : null}
      <ProgramsTable key={JSON.stringify(values)} values={values} />
    </div>
  );
}
