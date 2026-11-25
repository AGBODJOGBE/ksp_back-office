'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useResource } from '@/lib/use-resource';
import { activeAgents, activeTeams } from '@/features/cleaning/agents-api';
import { listCommunes } from '@/features/cleaning/api';
import { getPlanning } from '@/features/cleaning/planning-api';
import type { Assignment, PlanningItem } from '@/features/cleaning/planning-schemas';
import { planningTexts } from '@/features/cleaning/planning-texts';
import {
  assignmentKey,
  hasPlanningFilters,
  indexAssignments,
  itemsByDay,
  type PlanningValues,
  planningQuery,
  readPlanning,
  toPlanningFilters,
} from '@/features/cleaning/planning-view';
import { cleaningTexts } from '@/features/cleaning/texts';
import { periodDays } from '@/features/cleaning/visits-calendar';
import { AutoPlanning } from './planning-auto';
import { PlanningDays, PlanningLoads } from './planning-days';
import { PlanningFilterBar } from './planning-filter-bar';
import { type PlanningChoices, PlanningPanel } from './planning-panel';
import { ProposalsList } from './planning-proposals';
import { UnassignedColumn } from './planning-unassigned';
import { useHolidays } from './visits-calendar';
import { CalendarNav } from './visits-toolbar';
import type { Option } from './requests-filter-bar';
import { LoadingBlock, Note, ResourceView, useCleaningAccess } from './parts';

const t = planningTexts;

/** Agents et équipes actifs (choix d'affectation et filtres) ; une liste illisible reste vide. */
async function loadChoices(): Promise<PlanningChoices & { communes: Option[] }> {
  const [agents, teams, communes] = await Promise.allSettled([activeAgents(), activeTeams(), listCommunes()]);
  const agentList = agents.status === 'fulfilled' ? agents.value : [];
  return {
    agents: agentList,
    teams: teams.status === 'fulfilled' ? teams.value : [],
    names: new Map(agentList.map((agent) => [agent.id, `${agent.firstName} ${agent.lastName}`])),
    communes:
      communes.status === 'fulfilled'
        ? communes.value.map((item) => ({ value: item.communeKey, label: item.name }))
        : [],
  };
}

type Selection = { item: PlanningItem; trigger: HTMLButtonElement | null };

/** Période affichée, colonne « à affecter », intervention choisie, planification automatique. */
function Board({
  values,
  choices,
  canReadHolidays,
}: {
  values: PlanningValues;
  choices: PlanningChoices;
  canReadHolidays: boolean;
}) {
  const days = useMemo(() => periodDays(values), [values]);
  const filtersKey = JSON.stringify(toPlanningFilters(values));
  const planning = useResource(useCallback(() => getPlanning(JSON.parse(filtersKey)), [filtersKey]));
  const holidays = useHolidays(days, canReadHolidays);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [known, setKnown] = useState<ReadonlyMap<string, Assignment>>(new Map());
  const [version, setVersion] = useState(0);

  const byId = useMemo(
    () =>
      new Map(
        planning.state.status === 'ready' ? planning.state.data.items.map((item) => [item.id, item]) : [],
      ),
    [planning.state],
  );
  const remember = useCallback(
    (added: readonly Assignment[]) => setKnown((current) => indexAssignments(current, added)),
    [],
  );

  const changed = (added: readonly Assignment[], gone: Assignment | null) => {
    setKnown((current) => {
      const next = indexAssignments(current, added);
      if (gone) next.delete(assignmentKey(gone.target, gone.agentId));
      return next;
    });
    planning.refresh();
    setVersion((value) => value + 1);
  };

  const close = () => {
    const trigger = selection?.trigger;
    setSelection(null);
    if (trigger?.isConnected) trigger.focus();
  };
  const select = (item: PlanningItem, trigger: HTMLButtonElement) =>
    selection?.item.id === item.id ? close() : setSelection({ item, trigger });

  return (
    <div className="grid gap-8">
      {selection ? (
        <PlanningPanel
          key={selection.item.id}
          item={selection.item}
          choices={choices}
          known={known}
          onChanged={changed}
          onClose={close}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <UnassignedColumn
            key={version}
            zoneKey={values.zoneKey}
            selectedId={selection?.item.id ?? null}
            onSelect={select}
          />
        </div>
        <div className="grid min-w-0 gap-6 xl:col-start-1 xl:row-start-1">
          <ResourceView resource={planning} lines={8}>
            {(data) => (
              <div className="grid gap-6">
                <p className="text-small text-ink-muted" aria-live="polite">
                  {t.count(data.items.length)}
                </p>
                {data.items.length ? null : <Note>{hasPlanningFilters(values) ? t.empty : t.emptyAll}</Note>}
                <PlanningDays
                  days={days}
                  byDay={itemsByDay(data.items)}
                  holidays={holidays}
                  selectedId={selection?.item.id ?? null}
                  onSelect={select}
                />
                <PlanningLoads loads={data.loads} />
              </div>
            )}
          </ResourceView>
        </div>
      </div>
      <div className="border-line grid gap-8 border-t pt-6 lg:grid-cols-2">
        <AutoPlanning zoneKey={values.zoneKey} onDone={() => changed([], null)} />
        <ProposalsList
          reload={version}
          zoneKey={values.zoneKey}
          items={byId}
          names={choices.names}
          onLoaded={remember}
          onChanged={(added) => changed(added, null)}
        />
      </div>
    </div>
  );
}

/** Planning (`/nettoyage/planning`) : vue jour ou semaine, filtres dans l'adresse, droit de planifier. */
export function PlanningScreen() {
  const access = useCleaningAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const values = useMemo(() => readPlanning(new URLSearchParams(query)), [query]);
  const canPlan = access?.['cleaning.planning.manage'] ?? false;
  const choices = useResource(
    useCallback(() => (canPlan ? loadChoices() : Promise.resolve(null)), [canPlan]),
  );

  if (!access) return <LoadingBlock lines={8} />;
  if (!canPlan) return <Note>{cleaningTexts.common.forbidden}</Note>;

  const update = (changes: Partial<PlanningValues>) => {
    const next = planningQuery(query, changes);
    router.replace(next ? `${pathname}?${next}` : pathname);
  };
  const lists = choices.state.status === 'ready' ? choices.state.data : null;

  return (
    <div className="grid gap-6">
      <CalendarNav values={values} onChange={update} dateId="planning-date" />
      <PlanningFilterBar values={values} choices={lists} communes={lists?.communes ?? []} onChange={update} />
      {lists ? (
        <Board
          key={JSON.stringify(values)}
          values={values}
          choices={lists}
          canReadHolidays={access['cleaning.catalog.read']}
        />
      ) : (
        <LoadingBlock lines={8} />
      )}
    </div>
  );
}
