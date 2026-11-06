'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';

/**
 * Boîte d'envoi d'un devis (seul ou groupé) : récapitulatif, puis confirmation. `<dialog>` modal natif
 * (focus piégé, Échap pour revenir au formulaire, sauf pendant l'envoi). Le bouton d'envoi est désactivé
 * pendant l'envoi ; l'erreur s'affiche dans la boîte, qui reste ouverte pour renvoyer.
 */
export function SendDialog({
  open,
  title,
  lead,
  confirmLabel,
  labels,
  pending,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  lead: string;
  confirmLabel: string;
  labels: { back: string; pending: string };
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titre`}
      aria-describedby={`${id}-texte`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      className="rounded-card bg-surface text-ink shadow-raised backdrop:bg-brand-950/45 m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] max-w-none overflow-y-auto overscroll-contain p-0"
    >
      <div className="grid gap-4 p-5 sm:p-6">
        <h2 id={`${id}-titre`} className="font-display text-h3 font-semibold">
          {title}
        </h2>
        <p id={`${id}-texte`} className="text-ink-muted">
          {lead}
        </p>
        {children}
        <FormMessage>{error}</FormMessage>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {labels.back}
          </Button>
          <Button variant="action" aria-busy={pending || undefined} disabled={pending} onClick={onConfirm}>
            {pending ? labels.pending : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
