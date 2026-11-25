'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { type AgentFilterValues, SEARCH_MAX } from '@/features/cleaning/agents-filters';
import { AGENT_SORTS, AGENT_STATUSES } from '@/features/cleaning/agents-schemas';
import { agentSortName, agentStatus, agentsTexts } from '@/features/cleaning/agents-texts';
import { Choice, type Option } from './requests-filter-bar';

const t = agentsTexts.list;

/** Recherche par nom ou téléphone (100 caractères au plus), envoyée au bouton ou à Entrée. */
function Search({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function search(event: FormEvent) {
    event.preventDefault();
    if (value.length > SEARCH_MAX) {
      setError(t.tooLong);
      return;
    }
    setError(null);
    onSearch(value.trim());
  }

  return (
    <form onSubmit={search} className="flex max-w-md items-end gap-2">
      <TextField
        id="agents-recherche"
        label={t.search}
        hint={t.searchHint}
        error={error}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-w-0 flex-1"
        type="search"
        spellCheck={false}
        autoComplete="off"
      />
      <Button type="submit" variant="secondary">
        {t.searchButton}
      </Button>
    </form>
  );
}

/** Filtres du contrat (`GET /agents`) : recherche, statut, commune de travail, compétence, tri. */
export function AgentsFilterBar({
  values,
  communes,
  skills,
  onChange,
}: {
  values: AgentFilterValues;
  communes: readonly Option[];
  skills: readonly Option[];
  onChange: (changes: Partial<AgentFilterValues>) => void;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.filters}</legend>
      <Search key={values.q} initial={values.q} onSearch={(q) => onChange({ q })} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          id="agents-statut"
          label={t.status}
          value={values.status}
          all={t.all}
          options={AGENT_STATUSES.map((code) => ({ value: code, label: agentStatus(code).label }))}
          onChange={(status) => onChange({ status })}
        />
        <Choice
          id="agents-commune"
          label={t.commune}
          value={values.zoneKey}
          all={t.allFeminine}
          options={communes}
          onChange={(zoneKey) => onChange({ zoneKey })}
        />
        <Choice
          id="agents-competence"
          label={t.skill}
          value={values.skillCode}
          all={t.allFeminine}
          options={skills}
          onChange={(skillCode) => onChange({ skillCode })}
        />
        <SelectField
          id="agents-tri"
          label={t.sort}
          value={values.sort || 'lastName'}
          onChange={(event) =>
            onChange({ sort: event.target.value === 'lastName' ? '' : event.target.value })
          }
        >
          {AGENT_SORTS.map((code) => (
            <option key={code} value={code}>
              {agentSortName(code)}
            </option>
          ))}
        </SelectField>
      </div>
    </fieldset>
  );
}
