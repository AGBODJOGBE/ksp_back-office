'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { ResponsiveTable, type TableColumn } from '@/components/ui/responsive-table';
import { usePagedList } from '@/lib/use-paged-list';
import { catalogTexts } from '@/features/cleaning/catalog-texts';
import { loadErrorText } from '@/features/cleaning/errors';
import type { Page } from '@/features/cleaning/schemas';
import { BackLink, ListState, Note, UpdatedLine, useCleaningAccess } from './parts';

const l = catalogTexts.list;
const d = catalogTexts.detail;

/** Lien vers la fiche, qui rend toute la ligne cliquable (`stretched-link`). */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="stretched-link text-ink font-semibold underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/**
 * Liste d'un élément du catalogue : nombre total, bouton « Créer » pour qui gère le catalogue,
 * tableau (cartes sur téléphone), « Afficher plus ». `load` doit être stable.
 */
export function CatalogList<T>({
  load,
  columns,
  caption,
  empty,
  rowKey,
  createHref,
  createLabel,
  toolbar,
}: {
  load: (cursor?: string) => Promise<Page<T>>;
  columns: readonly TableColumn<T>[];
  caption: string;
  empty: string;
  rowKey: (row: T) => string;
  createHref?: string;
  createLabel?: string;
  toolbar?: ReactNode;
}) {
  const access = useCleaningAccess();
  const list = usePagedList(load, loadErrorText);
  const canManage = !!access?.['cleaning.catalog.manage'];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">{toolbar}</div>
        {createHref && canManage ? (
          <ButtonLink href={createHref} variant="action">
            {createLabel ?? l.create}
          </ButtonLink>
        ) : null}
      </div>
      <ListState list={list} empty={<Note>{empty}</Note>}>
        <ResponsiveTable caption={caption} columns={columns} rows={list.items} rowKey={rowKey} />
      </ListState>
    </div>
  );
}

/** En-tête d'une fiche : retour à la liste, titre, étiquettes, dernière modification. */
export function DetailHeader({
  backHref,
  title,
  badges,
  updatedAt,
  updatedByName,
}: {
  backHref: string;
  title: string;
  badges?: ReactNode;
  updatedAt?: string;
  updatedByName?: string | null;
}) {
  return (
    <div className="grid gap-2">
      <BackLink href={backHref}>{d.back}</BackLink>
      <Heading as="h1" size="h2">
        {title}
      </Heading>
      {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
      {updatedAt ? <UpdatedLine at={updatedAt} name={updatedByName ?? null} /> : null}
    </div>
  );
}

/** Message « élément créé » montré une fois sur la fiche, après la création (`?cree=1`). */
export function CreatedNotice() {
  const params = useSearchParams();
  return <FormMessage tone="success">{params.get('cree') ? d.created : null}</FormMessage>;
}

/** Après une création : ouvre la fiche avec l'accusé de création. */
export function useOpenCreated() {
  const router = useRouter();
  return (href: string) => router.replace(`${href}?cree=1`);
}

/**
 * Corps d'un `PATCH` : seulement les champs qui ont changé (« champs absents inchangés », contrat),
 * comparés en JSON pour les listes.
 */
export function changedFields<T extends object>(next: T, current: object): Partial<T> {
  const before = current as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (JSON.stringify(value) !== JSON.stringify(before[key])) body[key] = value;
  }
  return body as Partial<T>;
}
