'use client';

import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { TextAreaField } from '@/components/ui/select-field';
import type { CleaningAccess } from '@/features/cleaning/access';
import { requestDetailTexts } from '@/features/cleaning/request-detail-texts';
import type { CleaningRequest, Scalar } from '@/features/cleaning/requests-schemas';
import { retainedTexts } from '@/features/cleaning/request-work-texts';
import { cleaningTexts } from '@/features/cleaning/texts';
import { useIdempotencyKey } from './parts';

const c = cleaningTexts.common;
const t = requestDetailTexts;

/** Ce que chaque étape de la fiche reçoit : le dossier, sa mise à jour et les droits de la session. */
export interface StepProps {
  request: CleaningRequest;
  /** Remplace le dossier affiché par la réponse d'une action. */
  onChange: (request: CleaningRequest) => void;
  /** Relit le dossier (après une action qui renvoie une visite ou un devis). */
  onRefresh: () => void;
  access: CleaningAccess;
}

/**
 * Écriture avec clé d'idempotence (`Idempotency-Key`) : la même clé est renvoyée tant que l'issue est
 * inconnue, renouvelée après une réussite ou un refus définitif.
 */
export function useKeyed() {
  const idempotency = useIdempotencyKey();
  return async <T,>(action: (key: string) => Promise<T>): Promise<T> => {
    try {
      const result = await action(idempotency.key());
      idempotency.settle();
      return result;
    } catch (error) {
      idempotency.settle(error);
      throw error;
    }
  };
}

/** Libellés des boîtes de confirmation. */
export const confirmLabels = { cancel: c.cancel, pending: c.sending };

export const MAX_REASON = 500;

/** Motif saisi dans une boîte de confirmation (`name="reason"`), sans espaces de bord. */
export const reasonOf = (data: FormData, name = 'reason') => String(data.get(name) ?? '').trim();

/** Contrôle local d'un motif obligatoire ; `null` s'il est bon. */
export function reasonError(reason: string): string | null {
  if (!reason) return c.required;
  if (reason.length > MAX_REASON) return c.tooLong(MAX_REASON);
  return null;
}

/** Zone de motif d'une boîte de confirmation (lue dans le `FormData`). */
export function ReasonField({
  id,
  label = t.reason,
  name = 'reason',
  required = true,
}: {
  id: string;
  label?: string;
  name?: string;
  required?: boolean;
}) {
  return (
    <TextAreaField
      id={id}
      name={name}
      label={label}
      hint={t.reasonHint}
      maxLength={MAX_REASON}
      required={required}
    />
  );
}

export function StatusBadge({ status }: { status: { label: string; tone: BadgeTone } }) {
  return (
    <Badge tone={status.tone} dot>
      {status.label}
    </Badge>
  );
}

/** Valeur d'un paramètre lisible : oui/non, nombre, code de choix. */
export function scalarText(value: Scalar | null | undefined): string {
  if (value === null || value === undefined) return retainedTexts.noValue;
  if (typeof value === 'boolean') return value ? retainedTexts.yes : retainedTexts.no;
  return String(value);
}

/** Section d'une étape, repérée par une ancre (`#etape-visit`) pour l'action suivante. */
export function StepSection({
  step,
  title,
  action,
  children,
}: {
  step: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`etape-${step}`}
      aria-labelledby={`etape-${step}-titre`}
      tabIndex={-1}
      className="rounded-card border-line bg-surface grid min-w-0 scroll-mt-24 content-start gap-4 border p-4 focus-visible:outline-2 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`etape-${step}-titre`} className="font-display text-h3 text-ink font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Liens vers les photos (lien temporaire) ; une photo non conservée est signalée. */
export function PhotoLinks({
  photos,
  label,
  action,
}: {
  photos: readonly { fileId: string; url: string | null }[];
  label: (rank: number) => string;
  action?: (photo: { fileId: string }, rank: number) => ReactNode;
}) {
  return (
    <ul className="flex flex-wrap gap-3">
      {photos.map((photo, index) => (
        <li key={photo.fileId} className="flex flex-wrap items-center gap-2">
          {photo.url ? (
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent-ink inline-flex min-h-11 items-center font-semibold underline"
            >
              {label(index + 1)}
            </a>
          ) : (
            <span className="text-ink-muted">
              {label(index + 1)} ({t.request.photoExpired})
            </span>
          )}
          {action?.(photo, index + 1)}
        </li>
      ))}
    </ul>
  );
}
