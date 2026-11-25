'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { useResource } from '@/lib/use-resource';
import { allCleaningTypes, allPlaceTypes, listCommunes } from '@/features/cleaning/api';
import { NUMBER_MAX, type RequestFilterValues } from '@/features/cleaning/requests-filters';
import { CUSTOMER_KINDS, REQUEST_SORTS, REQUEST_STATUSES } from '@/features/cleaning/requests-schemas';
import {
  customerKindName,
  requestSortName,
  requestStatus,
  requestsTexts,
} from '@/features/cleaning/requests-texts';

const t = requestsTexts.queue;

/** Choix des listes déroulantes (communes, lieux, types) ; vides si la lecture échoue. */
async function loadChoices() {
  const [communes, places, types] = await Promise.allSettled([
    listCommunes(),
    allPlaceTypes(),
    allCleaningTypes(),
  ]);
  const ok = <T,>(result: PromiseSettledResult<T[]>) => (result.status === 'fulfilled' ? result.value : []);
  return {
    communes: ok(communes).map((item) => ({ value: item.communeKey, label: item.name })),
    places: ok(places).map((item) => ({ value: item.id, label: item.name })),
    types: ok(types).map((item) => ({ value: item.id, label: item.name })),
  };
}

type Option = { value: string; label: string };

/** Liste de choix ; une valeur de l'adresse absente des choix reste affichée telle quelle. */
function Choice({
  id,
  label,
  value,
  all,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  all: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  const known = !value || options.some((option) => option.value === value);
  return (
    <SelectField id={id} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{all}</option>
      {known ? null : <option value={value}>{value}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

/** Recherche par numéro de dossier (50 caractères au plus), envoyée au bouton ou à Entrée. */
function NumberSearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [number, setNumber] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function search(event: FormEvent) {
    event.preventDefault();
    if (number.length > NUMBER_MAX) {
      setError(t.tooLong);
      return;
    }
    setError(null);
    onSearch(number.trim());
  }

  return (
    <form onSubmit={search} className="flex max-w-md items-end gap-2">
      <TextField
        id="dossiers-numero"
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

/** Filtres du contrat (`GET /requests`) : numéro, statut, clientèle, commune, lieu, type, dates, tri. */
export function RequestsFilterBar({
  values,
  onChange,
}: {
  values: RequestFilterValues;
  onChange: (changes: Partial<RequestFilterValues>) => void;
}) {
  const choices = useResource(loadChoices);
  const lists = choices.state.status === 'ready' ? choices.state.data : null;

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{t.filters}</legend>
      <NumberSearch key={values.q} initial={values.q} onSearch={(q) => onChange({ q })} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          id="dossiers-statut"
          label={t.status}
          value={values.status}
          all={t.all}
          options={REQUEST_STATUSES.map((code) => ({ value: code, label: requestStatus(code).label }))}
          onChange={(status) => onChange({ status })}
        />
        <Choice
          id="dossiers-clientele"
          label={t.customerKind}
          value={values.customerKind}
          all={t.allFeminine}
          options={CUSTOMER_KINDS.map((code) => ({ value: code, label: customerKindName(code) }))}
          onChange={(customerKind) => onChange({ customerKind })}
        />
        <Choice
          id="dossiers-commune"
          label={t.commune}
          value={values.communeKey}
          all={t.allFeminine}
          options={lists?.communes ?? []}
          onChange={(communeKey) => onChange({ communeKey })}
        />
        <Choice
          id="dossiers-lieu"
          label={t.place}
          value={values.placeTypeId}
          all={t.all}
          options={lists?.places ?? []}
          onChange={(placeTypeId) => onChange({ placeTypeId })}
        />
        <Choice
          id="dossiers-type"
          label={t.cleaningType}
          value={values.cleaningTypeId}
          all={t.all}
          options={lists?.types ?? []}
          onChange={(cleaningTypeId) => onChange({ cleaningTypeId })}
        />
        <TextField
          id="dossiers-du"
          type="date"
          label={t.from}
          value={values.from}
          max={values.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <TextField
          id="dossiers-au"
          type="date"
          label={t.to}
          value={values.to}
          min={values.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
        />
        <SelectField
          id="dossiers-tri"
          label={t.sort}
          value={values.sort || '-createdAt'}
          onChange={(event) =>
            onChange({ sort: event.target.value === '-createdAt' ? '' : event.target.value })
          }
        >
          {REQUEST_SORTS.map((code) => (
            <option key={code} value={code}>
              {requestSortName(code)}
            </option>
          ))}
        </SelectField>
      </div>
    </fieldset>
  );
}
