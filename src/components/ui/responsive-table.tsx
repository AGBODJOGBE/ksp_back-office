import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * Colonne principale : en tête de la carte sur téléphone, sans libellé. Y placer le lien vers la fiche
   * avec la classe `stretched-link` rend toute la ligne (ou la carte) cliquable.
   */
  primary?: boolean;
  className?: string;
}

const CELL = cn(
  'md:border-line md:border-b md:px-4 md:py-3 md:align-top md:group-last/row:border-b-0',
  'max-md:flex max-md:flex-wrap max-md:items-baseline max-md:justify-between max-md:gap-x-4 max-md:gap-y-2',
);
const LABELLED = cn(
  'max-md:before:text-small max-md:before:text-ink-muted max-md:before:shrink-0 max-md:before:font-medium',
  'max-md:before:content-[attr(data-label)]',
);

/**
 * Tableau qui devient une liste de cartes sous 768 px : une seule structure, l'en-tête de colonne est
 * répété dans chaque cellule (`data-label`) sur téléphone. Aucune bibliothèque, aucun état.
 * À faire converger avec le portail avant `ksp-ui` (F-003).
 */
export function ResponsiveTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  className,
}: {
  /** Titre du tableau, lu par les lecteurs d'écran. */
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  className?: string;
}) {
  return (
    <div
      className={cn('md:rounded-card md:border-line md:bg-surface md:overflow-x-auto md:border', className)}
    >
      <table className="w-full border-separate border-spacing-0 text-left max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead className="max-md:sr-only">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-line bg-surface-muted text-small text-ink-muted border-b px-4 py-3 font-semibold whitespace-nowrap first:rounded-tl-[inherit] last:rounded-tr-[inherit]"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:grid max-md:gap-3">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'group/row md:hover:bg-surface-muted relative',
                'max-md:rounded-card max-md:border-line max-md:bg-surface max-md:grid max-md:gap-2 max-md:border max-md:p-4',
                'has-[.stretched-link:focus-visible]:outline-focus has-[.stretched-link:focus-visible]:outline-2',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.primary ? undefined : column.header}
                  className={cn(CELL, column.primary ? 'text-ink font-semibold' : LABELLED, column.className)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
