'use client';

import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { LoadingBlock as BaseLoadingBlock } from '@/components/ui/loading-block';
import { ResourceView as BaseResourceView } from '@/components/ui/resource-view';
import { useSession } from '@/lib/api';
import type { Resource } from '@/lib/use-resource';
import { type CleaningAccess, cleaningAccess } from '@/features/cleaning/access';
import { errorText } from '@/features/cleaning/errors';
import { cleaningTexts, statusOf } from '@/features/cleaning/texts';

export { BackLink } from '@/components/ui/back-link';
export { Panel } from '@/components/ui/panel';

const t = cleaningTexts.common;

/** Droits d'affichage de l'agent connecté (rôles de la session) ; `null` tant que la session n'est pas reprise. */
export function useCleaningAccess(): CleaningAccess | null {
  const current = useSession();
  return current ? cleaningAccess(current.roles) : null;
}

export function StatusBadge({
  map,
  code,
}: {
  map: Record<string, { label: string; tone: BadgeTone }>;
  code: string;
}) {
  const status = statusOf(map, code);
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

/** Squelette d'un écran en chargement : réserve la place du contenu, sans décalage à l'arrivée. */
export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return <BaseLoadingBlock lines={lines} label={t.loading} />;
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>{errorText(error)}</FormMessage>
      <Button variant="secondary" onClick={onRetry}>
        {t.retry}
      </Button>
    </div>
  );
}

/** États d'une ressource lue à la gateway : chargement, erreur avec « Réessayer », contenu. */
export function ResourceView<T>({
  resource,
  lines,
  children,
}: {
  resource: Resource<T>;
  lines?: number;
  children: (data: T) => ReactNode;
}) {
  return (
    <BaseResourceView resource={resource} lines={lines} labels={t} describe={errorText}>
      {children}
    </BaseResourceView>
  );
}

/** Message neutre (aucune action, réservé à un rôle…). */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}
