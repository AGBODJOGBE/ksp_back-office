import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Container } from './container';

export type SectionTone = 'default' | 'muted' | 'accent' | 'inverse';

const TONES: Record<SectionTone, string> = {
  default: '',
  muted: 'bg-surface-muted',
  accent: 'bg-accent-soft',
  inverse: '',
};

/**
 * Bloc de page avec le rythme vertical de la charte. Le ton « inverse » (bleu nuit) redéfinit les
 * jetons sémantiques : les composants placés dedans s'adaptent sans variante dédiée.
 */
export function Section({
  children,
  id,
  labelledBy,
  tone = 'default',
  spacing = 'default',
  className,
  containerClassName,
  contained = true,
}: {
  children: ReactNode;
  id?: string;
  /** Identifiant du titre de la section (`aria-labelledby`). */
  labelledBy?: string;
  tone?: SectionTone;
  spacing?: 'default' | 'small';
  className?: string;
  containerClassName?: string;
  /** `false` pour une section pleine largeur (le contenu gère alors sa propre largeur). */
  contained?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-tone={tone === 'inverse' ? 'inverse' : undefined}
      className={cn('relative', spacing === 'small' ? 'py-section-sm' : 'py-section', TONES[tone], className)}
    >
      {contained ? <Container className={containerClassName}>{children}</Container> : children}
    </section>
  );
}
