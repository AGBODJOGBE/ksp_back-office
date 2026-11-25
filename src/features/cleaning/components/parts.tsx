'use client';

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { LoadingBlock as BaseLoadingBlock } from '@/components/ui/loading-block';
import { PagedListState } from '@/components/ui/paged-list-state';
import { ResourceView as BaseResourceView } from '@/components/ui/resource-view';
import { newIdempotencyKey, useSession } from '@/lib/api';
import { formatDateTime, formatXof } from '@/lib/format';
import type { PagedList } from '@/lib/use-paged-list';
import type { Resource } from '@/lib/use-resource';
import { type CleaningAccess, cleaningAccess } from '@/features/cleaning/access';
import { errorStatus, errorText, loadErrorText, placeError } from '@/features/cleaning/errors';
import type { Money, VisibilityReason } from '@/features/cleaning/schemas';
import { activeBadge, cleaningTexts, nameOr, visibilityReason } from '@/features/cleaning/texts';

export { BackLink } from '@/components/ui/back-link';
export { Panel } from '@/components/ui/panel';

const t = cleaningTexts.common;

/** Droits d'affichage de la session (`access.ts`) ; `null` tant que la session n'est pas reprise. */
export function useCleaningAccess(): CleaningAccess | null {
  const current = useSession();
  return current ? cleaningAccess(current) : null;
}

/** Squelette d'un écran en chargement : réserve la place du contenu, sans décalage à l'arrivée. */
export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  return <BaseLoadingBlock lines={lines} label={t.loading} />;
}

/** Message neutre (aucune action, droit réservé…). */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink-muted">{children}</p>;
}

/**
 * États d'une ressource lue à la gateway : chargement, erreur avec « Réessayer », contenu. Un 403 devient
 * une note neutre et un 404 un message « introuvable », sans « Réessayer ».
 */
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

/** Actif ou désactivé (un élément du catalogue n'est jamais supprimé, R-CA-06). */
export function ActiveBadge({ active, feminine = false }: { active: boolean; feminine?: boolean }) {
  const badge = activeBadge(active, feminine);
  return (
    <Badge tone={badge.tone} dot>
      {badge.label}
    </Badge>
  );
}

/** Visible sur le portail, ou masqué avec ses raisons (`visibilityReasons`, R-CA-12). */
export function VisibilityBadge({
  visible,
  reasons,
}: {
  visible: boolean;
  reasons: readonly VisibilityReason[];
}) {
  if (visible) return <Badge tone="action">Visible sur le portail</Badge>;
  const why = reasons.map(visibilityReason).join(', ');
  return <Badge tone="warning">{why ? `Masqué : ${why}` : 'Masqué sur le portail'}</Badge>;
}

/** Dernière modification, à l'heure du Bénin, avec le nom lu dans identity. */
export function UpdatedLine({ at, name }: { at: string; name: string | null }) {
  return (
    <p className="text-small text-ink-muted">{t.updated(formatDateTime(at), nameOr(name, t.someone))}</p>
  );
}

/** Montant en FCFA, ou mention « masqué » quand la gateway ne le renvoie pas (`cleaning.amounts.read`). */
export function Amount({ value, empty = '—' }: { value: Money | null | undefined; empty?: string }) {
  if (value === undefined) return <span className="text-ink-muted">{t.amountHidden}</span>;
  if (value === null) return <span className="text-ink-muted">{empty}</span>;
  return <span className="tabular-nums">{formatXof(value)}</span>;
}

/**
 * Clé d'idempotence d'une écriture (`Idempotency-Key`) : tirée au premier envoi, renvoyée telle quelle
 * quand l'issue est inconnue (coupure réseau, erreur du serveur) pour qu'un nouvel essai ne crée rien
 * de plus ; renouvelée après une réussite ou un refus définitif (la saisie va changer).
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
 * Envoi d'un formulaire : contrôles locaux d'abord (champ → message), puis l'appel ; un refus de la
 * gateway qui nomme un champ connu (`fields`, chemins du contrat) s'affiche sous ce champ, sinon en tête.
 * Après une erreur, le focus va sur le premier champ en cause.
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

  return { pending, message, errors, success, submit, clearSuccess: () => setSuccess(null) };
}

/** Bas d'un formulaire : message d'erreur ou de réussite, bouton d'envoi désactivé pendant l'envoi. */
export function FormFooter({
  pending,
  message,
  success,
  label,
  pendingLabel = t.saving,
  disabled,
}: {
  pending: boolean;
  message: string | null;
  success?: string | null;
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid justify-items-start gap-3">
      <FormMessage>{message}</FormMessage>
      <FormMessage tone="success">{success}</FormMessage>
      <Button type="submit" variant="action" aria-busy={pending || undefined} disabled={pending || disabled}>
        {pending ? pendingLabel : label}
      </Button>
    </div>
  );
}

/** Bouton d'action unique (réactiver…) : désactivé pendant l'envoi, erreur affichée à côté. */
export function ActionButton({
  label,
  accessibleLabel,
  onClick,
  variant = 'secondary',
}: {
  label: string;
  accessibleLabel?: string;
  onClick: () => Promise<unknown>;
  variant?: 'secondary' | 'action';
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="grid justify-items-start gap-2">
      <Button
        variant={variant}
        aria-busy={pending || undefined}
        disabled={pending}
        aria-label={pending ? undefined : accessibleLabel}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await onClick();
          } catch (caught) {
            setError(errorText(caught));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? t.sending : label}
      </Button>
      <FormMessage>{error}</FormMessage>
    </span>
  );
}
