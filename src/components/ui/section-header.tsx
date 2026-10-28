import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow } from './eyebrow';
import { Heading } from './heading';
import { frenchSpacing } from '@/lib/typography';

/** En-tête de section éditorial : surtitre, titre de niveau 2, chapeau et action facultative à droite. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  lead,
  action,
  className,
}: {
  /** Identifiant du titre, à relier à la section par `aria-labelledby`. */
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('reveal flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-reading">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading id={id} className="mt-4">
          {typeof title === 'string' ? frenchSpacing(title) : title}
        </Heading>
        {lead ? (
          <p className="text-lead text-ink-muted mt-4">
            {typeof lead === 'string' ? frenchSpacing(lead) : lead}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
