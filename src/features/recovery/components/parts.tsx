'use client';

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { LoadingBlock as BaseLoadingBlock } from '@/components/ui/loading-block';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResourceView as BaseResourceView } from '@/components/ui/resource-view';
import { newIdempotencyKey, useSession } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { PagedList } from '@/lib/use-paged-list';
import type { Resource } from '@/lib/use-resource';
import { type RecoveryAccess, recoveryAccess } from '@/features/recovery/access';
import { errorStatus, loadErrorText, placeError } from '@/features/recovery/errors';
import { actorName, recoveryTexts } from '@/features/recovery/texts';

export { BackLink } from '@/components/ui/back-link';
export { Panel } from '@/components/ui/panel';

const t = recoveryTexts.common;

/** Droits d'affichage de la session (`access.ts`) ; `null` tant que la session n'est pas reprise. */
export function useRecoveryAccess(): RecoveryAccess | null {
  const current = useSession();
  return current ? recoveryAccess(current) : null;
}

/** Identifiant du compte connecté (validation par une seconde personne). */
export function useSessionUserId(): string | null {
  return useSession()?.user.id ?? null;
}

export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return <BaseLoadingBlock lines={lines} label={t.loading} />;
}

/** Message neutre (aucune action, droit réservé…). */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}

/** États d'une ressource : chargement, erreur avec « Réessayer » ; 403 et 404 sans « Réessayer ». */
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
  if (state.status === 'error') {
    const status = errorStatus(state.error);
    if (status === 403) return <Note>{t.forbidden}</Note>;
    if (status === 404) return <FormMessage tone="info">{t.notFound}</FormMessage>;
  }
  return (
    <BaseResourceView resource={resource} lines={lines} labels={t} describe={loadErrorText}>
      {children}
    </BaseResourceView>
  );
}

/** Liste paginée : chargement, erreur avec « Réessayer », vide, « Afficher plus ». */
export function ListState<T>({
  list,
  empty,
  children,
}: {
  list: PagedList<T>;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <PagedListState list={list} empty={empty} labels={t}>
      {children}
    </PagedListState>
  );
}

/** Dernière modification : date (heure du Bénin) et auteur. */
export function UpdatedLine({
  at,
  by,
}: {
  at: string | null;
  by: { type: string; displayName: string | null } | null;
}) {
  return <Note>{at ? t.updated(formatDateTime(at), actorName(by)) : t.never}</Note>;
}

/**
 * Clé d'idempotence d'une écriture : tirée au premier envoi, renvoyée telle quelle quand l'issue est
 * inconnue (coupure, erreur du serveur), renouvelée après une réussite ou un refus définitif.
 */
export function useIdempotencyKey(): { key: () => string; settle: (error?: unknown) => void } {
  const ref = useRef<string | null>(null);
  return {
    key: () => (ref.current ??= newIdempotencyKey()),
    settle: (error?: unknown) => {
      const status = error === undefined ? null : errorStatus(error);
      if (status === 0 || (status !== null && status >= 500)) return;
      ref.current = null;
    },
  };
}

export type FieldErrors = Record<string, string>;

/**
 * Envoi d'un formulaire : contrôles locaux d'abord, puis l'appel ; un refus qui nomme un champ connu
 * s'affiche sous ce champ, sinon en tête. Après une erreur, le focus va sur le premier champ en cause.
 */
export function useFormSubmit(fields: readonly string[]) {
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!Object.keys(errors).length) return;
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, form]);

  async function submit(event: FormEvent, local: FieldErrors, action: () => Promise<string | void>) {
    event.preventDefault();
    if (pending) return;
    if (event.currentTarget instanceof HTMLFormElement) setForm(event.currentTarget);
    setSuccess(null);
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage(t.fixErrors);
      return;
    }
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const done = await action();
      if (done) setSuccess(done);
    } catch (error) {
      const placed = placeError(error, fields);
      if (placed.field) {
        setErrors({ [placed.field]: placed.message });
        setMessage(t.fixErrors);
      } else setMessage(placed.message);
    } finally {
      setPending(false);
    }
  }

  return { pending, message, errors, success, submit };
}

/** Bas d'un formulaire : message d'erreur ou de réussite, bouton d'envoi désactivé pendant l'envoi. */
export function FormFooter({
  pending,
  message,
  success,
  label,
  pendingLabel = t.saving,
  extra,
}: {
  pending: boolean;
  message: string | null;
  success?: string | null;
  label: string;
  pendingLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>{message}</FormMessage>
      <FormMessage tone="success">{success}</FormMessage>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="action" aria-busy={pending || undefined} disabled={pending}>
          {pending ? pendingLabel : label}
        </Button>
        {extra}
      </div>
    </div>
  );
}
