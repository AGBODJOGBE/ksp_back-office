'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconArrowLeft } from '@/components/ui/icons';
import { useSession } from '@/lib/api';
import type { Resource } from '@/lib/use-resource';
import { type CleaningAccess, cleaningAccess } from '@/features/cleaning/access';
import { errorText } from '@/features/cleaning/errors';
import { cleaningTexts, statusOf } from '@/features/cleaning/texts';

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
  return (
    <div aria-busy="true" className="grid gap-3">
      <p role="status" className="sr-only">
        {t.loading}
      </p>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="bg-surface-sunken rounded-control block h-12 animate-pulse"
          style={{ width: `${100 - (index % 3) * 12}%` }}
        />
      ))}
    </div>
  );
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
  const { state } = resource;
  if (state.status === 'loading') return <LoadingBlock lines={lines} />;
  if (state.status === 'error') return <LoadError error={state.error} onRetry={resource.reload} />;
  return <>{children(state.data)}</>;
}

/** Lien de retour vers la liste, au-dessus du titre d'une fiche. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-small text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-2 font-semibold"
    >
      <IconArrowLeft className="size-4" />
      {children}
    </Link>
  );
}

/** Bloc titré d'une fiche (client, locaux, passages…). */
export function Panel({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-card border-line bg-surface grid min-w-0 content-start gap-4 border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading as="h2" size="h3" id={id}>
          {title}
        </Heading>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Message neutre (aucune action, réservé à un rôle…). */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}
