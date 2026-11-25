'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { listCommunes } from '@/features/cleaning/api';
import { PROGRAM_NUMBER_MAX, type ProgramFilterValues } from '@/features/cleaning/programs-filters';
import { PROGRAM_SORTS, PROGRAM_STATUSES } from '@/features/cleaning/programs-schemas';
import {
  payerKindName,
  programSortName,
  programStatus,
  programsTexts,
} from '@/features/cleaning/programs-texts';
import { CUSTOMER_KINDS } from '@/features/cleaning/requests-schemas';
import { Choice } from './requests-filter-bar';

const t = programsTexts.list;

/** Communes de la liste déroulante ; vide si la lecture échoue (le filtre reste utilisable par l'adresse). */
async function loadCommunes() {
  try {
    return (await listCommunes()).map((item) => ({ value: item.communeKey, label: item.name }));
  } catch {
    return [];
  }
}

/** Recherche par numéro de programme (50 caractères au plus), envoyée au bouton ou à Entrée. */
function NumberSearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [number, setNumber] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function search(event: FormEvent) {
    event.preventDefault();
    if (number.length > PROGRAM_NUMBER_MAX) {
      setError(t.tooLong);
      return;
    }
    setError(null);
    onSearch(number.trim());
  }

  return (
    <form onSubmit={search} className="flex max-w-md items-end gap-2">
      <TextField
        id="programmes-numero"
        label={t.number}
        hint={t.numberHint}
        error={error}
        value={number}
        onChange={(event) => setNumber(event.target.value)}
        className="min-w-0 flex-1"
        type="search"
        spellCheck={false}
        autoComplete="off"
      />
      <Button type="submit" variant="secondary">
        {t.search}
      </Button>
    </form>
  );
}

/** Filtres du contrat (`GET /programs`) : numéro, statut, payeur, commune, tri. */
export function ProgramsFilterBar({
  values,
  onChange,
}: {
  values: ProgramFilterValues;
  onChange: (changes: Partial<ProgramFilterValues>) => void;
}) {
  const communes = useResource(loadCommunes);
  const options = communes.state.status === 'ready' ? communes.state.data : [];

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.filters}</legend>
      <NumberSearch key={values.q} initial={values.q} onSearch={(q) => onChange({ q })} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          id="programmes-statut"
          label={t.status}
          value={values.status}
          all={t.all}
          options={PROGRAM_STATUSES.map((code) => ({ value: code, label: programStatus(code).label }))}
          onChange={(status) => onChange({ status })}
        />
        <Choice
          id="programmes-payeur"
          label={t.payerKind}
          value={values.payerKind}
          all={t.all}
          options={CUSTOMER_KINDS.map((code) => ({ value: code, label: payerKindName(code) }))}
          onChange={(payerKind) => onChange({ payerKind })}
        />
        <Choice
          id="programmes-commune"
          label={t.commune}
          value={values.communeKey}
          all={t.allFeminine}
          options={options}
          onChange={(communeKey) => onChange({ communeKey })}
        />
        <SelectField
          id="programmes-tri"
          label={t.sort}
          value={values.sort || '-createdAt'}
          onChange={(event) =>
            onChange({ sort: event.target.value === '-createdAt' ? '' : event.target.value })
          }
        >
          {PROGRAM_SORTS.map((code) => (
            <option key={code} value={code}>
              {programSortName(code)}
            </option>
          ))}
        </SelectField>
      </div>
    </fieldset>
  );
}
