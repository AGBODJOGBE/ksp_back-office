import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import type { PagedList } from '@/lib/use-paged-list';

export interface PagedListLabels {
  loading: string;
  retry: string;
  loadMore: string;
  loadingMore: string;
}

/** États communs d'une liste paginée : chargement, erreur avec « Réessayer », vide, « Afficher plus ». */
export function PagedListState<T>({
  list,
  empty,
  labels: t,
  children,
}: {
  list: PagedList<T>;
  empty: ReactNode;
  labels: PagedListLabels;
  children: ReactNode;
}) {
  if (list.loading && !list.items.length) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">{t.loading}</span>
        {[0, 1, 2].map((row) => (
          <span
            key={row}
            aria-hidden="true"
            className="rounded-card border-line bg-surface grid gap-2 border p-4 sm:p-5"
          >
            <span className="bg-surface-sunken rounded-control h-4 w-2/3 max-w-xs animate-pulse motion-reduce:animate-none" />
            <span className="bg-surface-sunken rounded-control h-3 w-1/2 max-w-[14rem] animate-pulse motion-reduce:animate-none" />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {list.items.length ? children : list.error ? null : empty}
      {list.error ? (
        <div className="grid justify-items-start gap-3">
          <FormMessage>{list.error}</FormMessage>
          <Button variant="secondary" onClick={list.retry}>
            {t.retry}
          </Button>
        </div>
      ) : null}
      {list.hasMore && !list.error ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={list.loadMore}
          aria-busy={list.loadingMore || undefined}
        >
          {list.loadingMore ? t.loadingMore : t.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
