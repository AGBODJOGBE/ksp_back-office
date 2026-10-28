'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface PagedList<T> {
  items: T[];
  /** Première page en cours de lecture. */
  loading: boolean;
  /** Page suivante en cours de lecture. */
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/** Message affichable d'une erreur de lecture : celui de la gateway (déjà en français). */
function defaultDescribe(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur est survenue. Réessayez dans quelques instants.';
}

/**
 * Liste paginée par curseur (`limit`, `nextCursor`) : première page au chargement, « Afficher plus »
 * pour la suivante. Une erreur garde les éléments déjà lus et propose de réessayer la dernière lecture.
 * `load` doit être stable (fonction de module ou `useCallback`).
 */
export function usePagedList<T>(
  load: (cursor?: string) => Promise<Page<T>>,
  describe: (error: unknown) => string = defaultDescribe,
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lecture demandée : `undefined` pour la première page, sinon le curseur ; `attempt` relance la même.
  const [request, setRequest] = useState<{ cursor?: string; attempt: number }>({ attempt: 0 });

  useEffect(() => {
    let active = true;
    const from = request.cursor;
    load(from).then(
      (page) => {
        if (!active) return;
        setItems((previous) => (from ? [...previous, ...page.data] : page.data));
        setCursor(page.nextCursor);
        setStarted(true);
        setLoading(false);
        setLoadingMore(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setError(describe(caught));
        setLoading(false);
        setLoadingMore(false);
      },
    );
    return () => {
      active = false;
    };
  }, [load, describe, request]);

  function requestPage(from?: string) {
    setError(null);
    if (from) setLoadingMore(true);
    else setLoading(true);
    setRequest((previous) => ({ cursor: from, attempt: previous.attempt + 1 }));
  }

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: !!cursor,
    loadMore: () => {
      if (cursor && !loadingMore) requestPage(cursor);
    },
    retry: () => requestPage(started && cursor ? cursor : undefined),
  };
}
