import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DescriptionItem {
  term: string;
  value: ReactNode;
}

/**
 * Liste de couples libellé / valeur (`<dl>`) : une colonne sur téléphone, deux à partir de 640 px.
 * Une valeur absente (`null`) n'est pas affichée. À faire converger avec le portail avant `ksp-ui`.
 */
export function DescriptionList({
  items,
  className,
}: {
  items: readonly DescriptionItem[];
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(9rem,max-content)_1fr]', className)}>
      {items
        .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
        .map((item) => (
          <div key={item.term} className="grid gap-y-0.5 sm:col-span-2 sm:grid-cols-subgrid">
            <dt className="text-small text-ink-muted font-medium">{item.term}</dt>
            <dd className="text-ink min-w-0 break-words">{item.value}</dd>
          </div>
        ))}
    </dl>
  );
}
