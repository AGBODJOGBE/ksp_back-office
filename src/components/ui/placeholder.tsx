import type { ReactNode } from 'react';
import { IconClock } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/**
 * Emplacement de contenu « à venir » : visible, honnête, jamais confondu avec un vrai contenu.
 * Repérable par `data-placeholder` (inventaire avant mise en ligne).
 */
export function Placeholder({
  title,
  children,
  media,
  as: Tag = 'div',
  className,
}: {
  title: string;
  children?: ReactNode;
  /** Zone visuelle réservée (ex. future photo), affichée en haut, pleine largeur. */
  media?: ReactNode;
  as?: 'div' | 'li';
  className?: string;
}) {
  return (
    <Tag
      data-placeholder=""
      className={cn(
        'rounded-card border-line-strong text-ink-muted flex flex-col overflow-hidden border border-dashed',
        className,
      )}
    >
      {media}
      <span className="flex flex-col items-start gap-3 p-6">
        <span className="text-accent-ink inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <IconClock className="size-4" />À venir
        </span>
        <span className="text-ink font-semibold">{title}</span>
        {children ? <span className="text-small">{children}</span> : null}
      </span>
    </Tag>
  );
}
