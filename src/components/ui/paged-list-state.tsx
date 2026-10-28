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
      <p role="status" className="text-ink-muted">
        {t.loading}
      </p>
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
