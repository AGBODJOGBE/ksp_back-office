import type { ReactNode } from 'react';
import { SignatureArrow } from '@/components/ui/brand/signature';
import { cn } from '@/lib/cn';

/**
 * Surtitre : capitales espacées précédées de la flèche or de la signature. Texte bleu nuit sur fond
 * clair, or sur fond bleu nuit (`accent-ink`) : l'or n'est jamais un texte sur fond clair.
 */
export function Eyebrow({
  children,
  as: Tag = 'p',
  className,
}: {
  children: ReactNode;
  as?: 'p' | 'span';
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        'text-eyebrow text-accent-ink inline-flex items-center gap-2 font-semibold uppercase',
        className,
      )}
    >
      <SignatureArrow className="h-2.5 w-2" />
      {children}
    </Tag>
  );
}
