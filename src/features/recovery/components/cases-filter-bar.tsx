'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SelectField } from '@/components/ui/select-field';
import { caseListTexts } from '@/features/recovery/case-list-texts';
import type { CaseQuery } from '@/features/recovery/cases-api';
import { CASE_PARAMS, type CaseFilterKey, type CaseFilters, recoveryPaths } from '@/features/recovery/paths';
import { CASE_KINDS, CASE_STAGES, CASE_STATUSES } from '@/features/recovery/schemas';
import { caseStatusLabel, kindLabel, stageLabel } from '@/features/recovery/texts';

const t = caseListTexts;

/** Raccourcis vers ce qui attend une action (mêmes filtres que le tableau de bord). */
export function PriorityLinks({ filters, userId }: { filters: CaseQuery; userId: string | null }) {
  const shortcuts: { label: string; filters: CaseFilters }[] = [
    { label: t.priority.review, filters: { status: 'under_review' } },
    { label: t.priority.info, filters: { status: 'info_requested' } },
    { label: t.priority.idle, filters: { idleDays: 7 } },
    { label: t.priority.prescription, filters: { prescriptionNear: true } },
    ...(userId ? [{ label: t.priority.mine, filters: { agentId: userId } }] : []),
  ];
  const current = recoveryPaths.casesWith(filters);
  return (
    <nav aria-label={t.priority.label} className="grid gap-2">
      <p className="text-small text-ink-muted font-semibold">{t.priority.label}</p>
      <ul className="flex flex-wrap gap-2">
        {shortcuts.map((item) => {
          const href = recoveryPaths.casesWith(item.filters);
          const active = href === current;
          return (
            <li key={item.label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'bg-accent-soft text-accent-ink border-accent-ink text-small inline-flex min-h-11 items-center rounded-full border px-4 font-semibold'
                    : 'border-line-control text-small text-ink hover:bg-surface-muted inline-flex min-h-11 items-center rounded-full border px-4 font-semibold'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Filtres de la file : listes appliquées aussitôt, commune et inactivité par « Appliquer ». Chargé et
 * créancier arrivent du tableau de bord ou d'une fiche : affichés et retirables. La recherche reste
 * dans l'écran (un nom de débiteur n'entre jamais dans l'adresse).
 */
export function CasesFilterBar({
  filters,
  onChange,
  search,
  onSearch,
}: {
  filters: CaseQuery;
  onChange: (key: CaseFilterKey, value: string) => void;
  search: string;
  onSearch: (value: string) => void;
}) {
  const [commune, setCommune] = useState(String(filters.communeKey ?? ''));
  const [idle, setIdle] = useState(String(filters.idleDays ?? ''));
  const [idleError, setIdleError] = useState<string | null>(null);
  const [text, setText] = useState(search);
  const [searchError, setSearchError] = useState<string | null>(null);

  function apply(event: FormEvent) {
    event.preventDefault();
    const days = idle.trim();
    if (days && !(/^\d{1,3}$/.test(days) && Number(days) >= 1 && Number(days) <= 365)) {
      setIdleError(t.filters.invalidIdle);
      return;
    }
    setIdleError(null);
    onChange('communeKey', commune.trim().slice(0, 60));
    onChange('idleDays', days);
  }

  function find(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value && value.length < 3) {
      setSearchError(t.filters.searchTooShort);
      return;
    }
    setSearchError(null);
    onSearch(value);
  }

  const select = (
    key: 'status' | 'stage' | 'kind',
    label: string,
    values: readonly string[],
    name: (v: string) => string,
  ) => (
    <SelectField
      id={`dossiers-${CASE_PARAMS[key]}`}
      label={label}
      value={String(filters[key] ?? '')}
      onChange={(event) => onChange(key, event.target.value)}
    >
      <option value="">{t.filters.all}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {name(value)}
        </option>
      ))}
    </SelectField>
  );

  const chosen = [
    filters.agentId ? { key: 'agentId' as const, label: t.filters.agent } : null,
    filters.creditorId ? { key: 'creditorId' as const, label: t.filters.creditor } : null,
  ].filter((item) => item !== null);

  return (
    <div className="grid gap-4">
      <form role="search" noValidate onSubmit={find} className="flex flex-wrap items-end gap-3">
        <TextField
          id="dossiers-recherche"
          type="search"
          label={t.filters.search}
          hint={t.filters.searchHint}
          value={text}
          maxLength={100}
          error={searchError}
          className="min-w-0 flex-1 basis-64"
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          {t.filters.searchButton}
        </Button>
      </form>
      <fieldset className="grid gap-4">
        <legend className="sr-only">{t.filters.legend}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {select('status', t.filters.status, CASE_STATUSES, caseStatusLabel)}
          {select('stage', t.filters.stage, CASE_STAGES, stageLabel)}
          {select('kind', t.filters.kind, CASE_KINDS, kindLabel)}
        </div>
        <form noValidate onSubmit={apply} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <TextField
            id="dossiers-commune"
            label={t.filters.commune}
            hint={t.filters.communeHint}
            value={commune}
            maxLength={60}
            onChange={(event) => setCommune(event.target.value)}
          />
          <TextField
            id="dossiers-inactifs"
            inputMode="numeric"
            label={t.filters.idle}
            hint={t.filters.idleHint}
            value={idle}
            error={idleError}
            onChange={(event) => setIdle(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            {t.filters.apply}
          </Button>
        </form>
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5"
            checked={filters.prescriptionNear === true}
            onChange={(event) => onChange('prescriptionNear', event.target.checked ? 'true' : '')}
          />
          {t.filters.prescription}
        </label>
        {chosen.length ? (
          <ul className="flex flex-wrap gap-2">
            {chosen.map((item) => (
              <li key={item.key}>
                <Button
                  variant="ghost"
                  aria-label={t.filters.remove(item.label)}
                  onClick={() => onChange(item.key, '')}
                >
                  {item.label} ×
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>
    </div>
  );
}
