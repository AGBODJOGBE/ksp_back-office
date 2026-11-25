'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { SelectField } from '@/components/ui/select-field';
import { usePagedList } from '@/lib/use-paged-list';
import { loadErrorText } from '@/features/recovery/errors';
import { listRules, type RuleFilters } from '@/features/recovery/pricing-api';
import { OFFERS, PRICING_OBJECTS, type Rule, RULE_STATUSES } from '@/features/recovery/pricing-schemas';
import {
  modeLabel,
  objectLabel,
  offerLabel,
  pricingTexts,
  ruleStatus,
} from '@/features/recovery/pricing-texts';
import { recoveryPaths } from '@/features/recovery/paths';
import { ListState, Note, useRecoveryAccess } from './parts';
import { RuleStatusBadge, ruleTarget, ruleValidity } from './rule-summary';

const t = pricingTexts.list;

/** Filtres lus dans l'adresse (paramètres en français) ; une valeur hors contrat vaut « tous ». */
const PARAMS = { object: 'objet', status: 'etat', offer: 'offre' } as const;
type FilterKey = keyof typeof PARAMS;
const VALUES: Record<FilterKey, readonly string[]> = {
  object: PRICING_OBJECTS,
  status: RULE_STATUSES,
  offer: OFFERS,
};

function readFilters(params: { get: (name: string) => string | null }): RuleFilters {
  const filters: Record<string, string> = {};
  for (const key of Object.keys(PARAMS) as FilterKey[]) {
    const value = params.get(PARAMS[key]) ?? '';
    if (VALUES[key].includes(value)) filters[key] = value;
  }
  return filters as RuleFilters;
}

const columns: TableColumn<Rule>[] = [
  {
    key: 'label',
    header: t.columns.label,
    primary: true,
    cell: (rule) => (
      <span className="grid gap-0.5">
        <Link
          href={recoveryPaths.rule(rule.id)}
          className="text-accent-ink stretched-link underline-offset-4 hover:underline"
        >
          {rule.label}
        </Link>
        <span className="text-small text-ink-muted font-normal">{t.version(rule.version)}</span>
      </span>
    ),
  },
  { key: 'object', header: t.columns.object, cell: (rule) => objectLabel(rule.object) },
  { key: 'mode', header: t.columns.mode, cell: (rule) => modeLabel(rule.mode) },
  { key: 'target', header: t.columns.target, cell: ruleTarget },
  { key: 'validity', header: t.columns.validity, cell: ruleValidity },
  { key: 'status', header: t.columns.status, cell: (rule) => <RuleStatusBadge status={rule.status} /> },
];

function Filter({
  id,
  label,
  value,
  options,
  all,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  all: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField id={id} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{all}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

/** Règles tarifaires (`GET /recovery/pricing-rules`), filtrées dans l'adresse. */
export function RulesList() {
  const access = useRecoveryAccess();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = readFilters(params);
  const { object, status, offer } = filters;
  const load = useMemo(() => listRules({ object, status, offer }), [object, status, offer]);
  const list = usePagedList(load, loadErrorText);

  const setFilter = (name: FilterKey, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(PARAMS[name], value);
    else next.delete(PARAMS[name]);
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 gap-4 sm:grid-cols-3">
          <Filter
            id="regles-objet"
            label={t.object}
            value={filters.object ?? ''}
            options={PRICING_OBJECTS.map((value) => ({ value, label: objectLabel(value) }))}
            all={t.all}
            onChange={(value) => setFilter('object', value)}
          />
          <Filter
            id="regles-etat"
            label={t.status}
            value={filters.status ?? ''}
            options={RULE_STATUSES.map((value) => ({ value, label: ruleStatus(value).label }))}
            all={t.all}
            onChange={(value) => setFilter('status', value)}
          />
          <Filter
            id="regles-offre"
            label={t.offer}
            value={filters.offer ?? ''}
            options={OFFERS.map((value) => ({ value, label: offerLabel(value) }))}
            all={t.allFeminine}
            onChange={(value) => setFilter('offer', value)}
          />
        </div>
        {access?.pricingManage ? (
          <ButtonLink href={recoveryPaths.newRule} variant="action">
            {t.create}
          </ButtonLink>
        ) : null}
      </div>
      <ListState list={list} empty={<Note>{t.empty}</Note>}>
        <ResponsiveTable caption={t.caption} columns={columns} rows={list.items} rowKey={(rule) => rule.id} />
      </ListState>
    </div>
  );
}
