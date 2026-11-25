'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { cn } from '@/lib/cn';
import type { HolderFilter } from '@/features/wallet/requests-api';
import { holderKind, withdrawalTexts } from '@/features/wallet/requests-texts';
import { holderTypeOf, walletPaths } from '@/features/wallet/texts';

const c = withdrawalTexts;

/**
 * Filtres d'une liste des portefeuilles lus dans l'adresse (l'état se partage) : `?etat=` et, ensemble,
 * `?type=particulier&titulaire=<id>` (le contrat filtre sur `holderType` et `holderId` ensemble).
 */
export function useListFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const status = params.get('etat') || undefined;
  const type = holderTypeOf(params.get('type') ?? '');
  const id = params.get('titulaire');
  // Objet stable : les lectures en dépendent (`usePagedList` exige un `load` stable).
  const holder = useMemo<HolderFilter | undefined>(() => (type && id ? { type, id } : undefined), [type, id]);

  function update(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    change(next);
    const query = next.toString();
    replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return {
    status,
    holder,
    setStatus: (value: string) => update((next) => (value ? next.set('etat', value) : next.delete('etat'))),
    clearHolder: () =>
      update((next) => {
        next.delete('type');
        next.delete('titulaire');
      }),
  };
}

/** Choix de l'état (codes du contrat, libellés français) ; « Tous » retire le filtre. */
export function StatusFilter({
  id,
  value,
  statuses,
  labelOf,
  onChange,
}: {
  id: string;
  value?: string;
  statuses: readonly string[];
  labelOf: (code: string) => { label: string };
  onChange: (value: string) => void;
}) {
  return (
    <SelectField
      id={id}
      label={c.status}
      value={value ?? ''}
      className="w-full sm:max-w-xs"
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{c.all}</option>
      {statuses.map((code) => (
        <option key={code} value={code}>
          {labelOf(code).label}
        </option>
      ))}
    </SelectField>
  );
}

/** Filtre « Titulaire sélectionné » en cours, avec son lien vers le portefeuille et son retrait. */
export function HolderChip({ holder, onClear }: { holder?: HolderFilter; onClear: () => void }) {
  if (!holder) return null;
  return (
    <div className="border-line rounded-control flex flex-wrap items-center gap-3 border p-3">
      <span className="text-small grid gap-0.5">
        <span className="text-ink font-semibold">{c.byHolder}</span>
        <Link
          href={walletPaths.holder(holder.type, holder.id)}
          className="text-accent-ink break-all underline"
        >
          {`${holderKind(holder.type)} · ${holder.id}`}
        </Link>
      </span>
      <Button variant="secondary" onClick={onClear} aria-label={c.removeHolder}>
        {c.removeFilter}
      </Button>
    </div>
  );
}

/** Titulaire d'une ligne : type et identifiant, lien vers son portefeuille. */
export function HolderCell({
  holder,
  className,
}: {
  holder: { type: string; id: string };
  className?: string;
}) {
  const type = holder.type === 'user' || holder.type === 'organization' ? holder.type : null;
  const label = holderKind(holder.type);
  return (
    <span className={cn('grid gap-0.5', className)}>
      <span className="text-ink font-semibold">{label}</span>
      {type ? (
        <Link
          href={walletPaths.holder(type, holder.id)}
          aria-label={c.seeWallet(label)}
          className="text-accent-ink text-small break-all underline"
        >
          {holder.id}
        </Link>
      ) : (
        <span className="text-small text-ink-muted break-all">{holder.id}</span>
      )}
    </span>
  );
}
