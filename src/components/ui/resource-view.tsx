'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/loading-block';
import type { Resource } from '@/lib/use-resource';

export interface ResourceViewLabels {
  loading: string;
  retry: string;
}

/**
 * États d'une ressource lue à la gateway : chargement (squelette), erreur avec « Réessayer » (sauf
 * quand `retryable` dit non, par exemple une fiche introuvable), contenu.
 */
export function ResourceView<T>({
  resource,
  lines,
  labels,
  describe,
  retryable = () => true,
  children,
}: {
  resource: Resource<T>;
  lines?: number;
  labels: ResourceViewLabels;
  describe: (error: unknown) => string;
  retryable?: (error: unknown) => boolean;
  children: (data: T) => ReactNode;
}) {
  const { state } = resource;
  if (state.status === 'loading') return <LoadingBlock lines={lines} label={labels.loading} />;
  if (state.status === 'error') {
    return (
      <div className="grid justify-items-start gap-3">
        <FormMessage>{describe(state.error)}</FormMessage>
        {retryable(state.error) ? (
          <Button variant="secondary" onClick={resource.reload}>
            {labels.retry}
          </Button>
        ) : null}
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
