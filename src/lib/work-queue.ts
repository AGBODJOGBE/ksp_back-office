import type { ReactNode } from 'react';

/*
 * File « À traiter » du tableau de bord « Ma journée » : forme commune des sections que chaque
 * fonctionnalité fournit (lecture filtrée de la gateway, lignes à afficher), et règles d'affichage
 * communes (rôles, ordre, compteur). Aucune règle métier : les filtres sont ceux du contrat, les rôles
 * ceux de `x-ksp-roles`, et la gateway reste seule juge des droits.
 */

/**
 * Taille de la page lue pour chaque section : les listes de la gateway ne renvoient pas de total
 * (`data`, `nextCursor`), donc au-delà d'une page le compteur affiche « 20+ ».
 */
export const QUEUE_LIMIT = 20;

/** Lignes montrées par section ; « Tout voir » mène à la liste complète, déjà filtrée. */
export const QUEUE_ROWS = 5;

/** Action d'une ligne : lien vers l'écran où elle se fait, ou action sur place (boîte de confirmation). */
export type WorkQueueAction =
  { kind: 'link'; href: string; label: string } | { kind: 'inline'; render: (done: () => void) => ReactNode };

export interface WorkQueueRow {
  id: string;
  title: string;
  /** Précisions courtes (montant, commune, date), affichées sur une ligne séparées par « · ». */
  details: string[];
  action: WorkQueueAction;
}

export interface WorkQueuePage {
  rows: WorkQueueRow[];
  /** Éléments lus (au plus `QUEUE_LIMIT`). */
  count: number;
  /** La gateway a une page suivante (`nextCursor` non nul) : il y en a davantage que `count`. */
  more: boolean;
}

export interface WorkQueueSection {
  /** Identifiant stable : sert à l'ordre de priorité et aux clés. */
  id: string;
  title: string;
  description: string;
  /** Rôles qui peuvent lire la liste (`x-ksp-roles` de la route) : affichage seulement. */
  roles: readonly string[];
  seeAll: { href: string; label: string };
  load: (roles: readonly string[]) => Promise<WorkQueuePage>;
}

/** Page de la gateway (`data`, `nextCursor`) → page de la file : `QUEUE_ROWS` lignes au plus. */
export function toQueuePage<T>(
  page: { data: readonly T[]; nextCursor: string | null },
  row: (item: T) => WorkQueueRow,
): WorkQueuePage {
  return {
    rows: page.data.slice(0, QUEUE_ROWS).map(row),
    count: page.data.length,
    more: page.nextCursor !== null,
  };
}

/** « 3 », ou « 20+ » quand la gateway a une page suivante. */
export function countLabel(page: Pick<WorkQueuePage, 'count' | 'more'>): string {
  return page.more ? `${page.count}+` : String(page.count);
}

/**
 * Sections visibles pour ces rôles, dans l'ordre de priorité donné (identifiants) ; une section absente
 * de l'ordre vient après les autres. Affichage seulement : la gateway refuse de toute façon une lecture
 * hors des rôles.
 */
export function sectionsFor(
  roles: readonly string[],
  sections: readonly WorkQueueSection[],
  order: readonly string[],
): WorkQueueSection[] {
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return sections
    .filter((section) => section.roles.some((role) => roles.includes(role)))
    .sort((a, b) => rank(a.id) - rank(b.id));
}
