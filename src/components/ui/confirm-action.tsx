'use client';

import { type FormEvent, type ReactNode, useId, useRef, useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';

export interface ConfirmActionLabels {
  cancel: string;
  pending: string;
}

/**
 * Action sensible confirmée dans une boîte de dialogue native (`<dialog>` modale : focus piégé,
 * Échap pour fermer, fond inerte). Le contenu (`children`) peut porter des champs : ils sont lus dans
 * le `FormData` passé à `onConfirm`, qui renvoie un message d'erreur ou `null` si l'action a réussi.
 * À faire converger avec le portail avant `ksp-ui` (F-003).
 */
export function ConfirmAction({
  label,
  accessibleLabel,
  title,
  description,
  confirmLabel,
  labels,
  children,
  onConfirm,
  variant = 'secondary',
  danger = false,
  className,
}: {
  /** Libellé du bouton qui ouvre la boîte. */
  label: ReactNode;
  /**
   * Nom accessible du bouton quand plusieurs boutons portent le même libellé (une ligne de tableau) :
   * il doit commencer par le libellé visible, par exemple « Désactiver Cotonou ».
   */
  accessibleLabel?: string;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  labels: ConfirmActionLabels;
  children?: ReactNode;
  onConfirm: (data: FormData) => Promise<string | null>;
  variant?: ButtonVariant;
  /** Action destructrice (refus, annulation, désactivation) : bouton de confirmation rouge. */
  danger?: boolean;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    ref.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    const message = await onConfirm(new FormData(form));
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    form.reset();
    ref.current?.close();
  }

  return (
    <>
      <Button variant={variant} onClick={open} className={className} aria-label={accessibleLabel}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-titre`}
        aria-describedby={description ? `${id}-texte` : undefined}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="rounded-card bg-surface text-ink shadow-raised m-auto w-[min(32rem,calc(100vw-2rem))] max-w-none p-0 backdrop:bg-[rgb(7_18_36/0.45)]"
      >
        <form noValidate onSubmit={submit} className="grid gap-4 p-6">
          <h2 id={`${id}-titre`} className="font-display text-h3 font-semibold">
            {title}
          </h2>
          {description ? (
            <div id={`${id}-texte`} className="text-ink-muted">
              {description}
            </div>
          ) : null}
          {children}
          <FormMessage>{error}</FormMessage>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" disabled={pending} onClick={() => ref.current?.close()}>
              {labels.cancel}
            </Button>
            <Button
              type="submit"
              aria-busy={pending || undefined}
              disabled={pending}
              variant={danger ? 'danger' : 'primary'}
            >
              {pending ? labels.pending : confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
