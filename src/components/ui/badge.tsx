import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'action' | 'success' | 'warning' | 'danger';

/* L'or (accent) n'est qu'un fond : le texte de l'étiquette reste bleu nuit (contraste ≥ 12:1). */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  brand: 'bg-brand-soft text-brand-ink ring-1 ring-inset ring-brand-muted',
  accent: 'bg-accent-soft text-ink ring-1 ring-inset ring-accent-muted',
  action: 'bg-action-soft text-action-ink ring-1 ring-inset ring-action-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

/* Pastille d'état : la couleur aide, le texte suffit (le sens ne repose jamais sur la couleur seule). */
const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-ink-subtle',
  brand: 'bg-brand-ink',
  accent: 'bg-accent',
  action: 'bg-action',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Étiquette courte (statut, catégorie). `dot` : pastille d'état devant le libellé. */
export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
