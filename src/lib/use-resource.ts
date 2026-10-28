'use client';

import { useEffect, useState } from 'react';

export type ResourceState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

export interface Resource<T> {
  state: ResourceState<T>;
  /** Relit en affichant le chargement (« Réessayer »). */
  reload: () => void;
  /** Relit en gardant l'affichage actuel (après un conflit, pour montrer l'état réel). */
  refresh: () => void;
  /** Remplace la donnée par la réponse d'une action (refus, annulation…). */
  set: (data: T) => void;
}

/**
 * Lecture d'une ressource de la gateway dans un composant client. `load` doit être stable
 * (`useCallback`) : un changement relance la lecture. Les réponses arrivées après le démontage sont ignorées.
 */
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt]);

  return {
    state,
    reload: () => {
      setState({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
    refresh: () => setAttempt((value) => value + 1),
    set: (data) => setState({ status: 'ready', data }),
  };
}
