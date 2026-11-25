'use client';

import { Button } from '@/components/ui/button';
import { type PlanningValues, hasPlanningFilters } from '@/features/cleaning/planning-view';
import { planningTexts } from '@/features/cleaning/planning-texts';
import type { PlanningChoices } from './planning-panel';
import { Choice, type Option } from './requests-filter-bar';

const t = planningTexts;

/** Filtres du contrat (`GET /planning`) : agent, équipe, commune ; la période vient de la navigation. */
export function PlanningFilterBar({
  values,
  choices,
  communes,
  onChange,
}: {
  values: PlanningValues;
  choices: PlanningChoices | null;
  communes: readonly Option[];
  onChange: (changes: Partial<PlanningValues>) => void;
}) {
  const agents = (choices?.agents ?? []).map((agent): Option => ({
    value: agent.id,
    label: `${agent.firstName} ${agent.lastName}`,
  }));
  const teams = (choices?.teams ?? []).map((team): Option => ({ value: team.id, label: team.name }));
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.filters}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Choice
          id="planning-agent"
          label={t.agent}
          value={values.agentId}
          all={t.all}
          options={agents}
          onChange={(agentId) => onChange({ agentId })}
        />
        <Choice
          id="planning-equipe"
          label={t.team}
          value={values.teamId}
          all={t.allFeminine}
          options={teams}
          onChange={(teamId) => onChange({ teamId })}
        />
        <Choice
          id="planning-commune"
          label={t.zone}
          value={values.zoneKey}
          all={t.allFeminine}
          options={communes}
          onChange={(zoneKey) => onChange({ zoneKey })}
        />
      </div>
      {hasPlanningFilters(values) ? (
        <Button
          variant="ghost"
          className="justify-self-start"
          onClick={() => onChange({ agentId: '', teamId: '', zoneKey: '' })}
        >
          {t.clear}
        </Button>
      ) : null}
    </fieldset>
  );
}
