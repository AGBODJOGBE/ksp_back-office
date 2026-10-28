import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardTone = 'default' | 'accent' | 'inverse';

const INTERACTIVE = cn(
  'group/card isolate transition-transform duration-(--motion-slow) ease-soft',
  'hover:-translate-y-1 has-[.stretched-link:active]:translate-y-0',
  // Ombre portée en fondu (on anime son opacité, pas la propriété box-shadow).
  'after:absolute after:inset-0 after:-z-10 after:rounded-card after:shadow-raised',
  'after:opacity-0 after:transition-opacity after:duration-(--motion-slow) after:ease-soft hover:after:opacity-100',
  // Le focus du lien étiré entoure toute la carte.
  'has-[.stretched-link:focus-visible]:outline-2 has-[.stretched-link:focus-visible]:outline-offset-3',
);

/*
 * Couleur de l'anneau de focus : il est dessiné à l'extérieur de la carte, donc sur le fond qui l'entoure.
 * Une carte bleu nuit posée sur fond clair garde l'anneau bleu du fond clair (contraste ≥ 3:1).
 */
const FOCUS_RING: Record<CardTone, string> = {
  default: 'has-[.stretched-link:focus-visible]:outline-focus',
  accent: 'has-[.stretched-link:focus-visible]:outline-focus',
  inverse: 'has-[.stretched-link:focus-visible]:outline-brand-600',
};

const TONES: Record<CardTone, string> = {
  default: 'bg-surface border-line',
  accent: 'bg-accent-soft border-accent-muted',
  // Le ton inverse redéfinit les jetons (fond bleu nuit) : voir [data-tone='inverse'] dans globals.css.
  inverse: 'border-transparent',
};

/**
 * Carte de contenu. `interactive` : légère élévation au survol.
 * Pour la rendre cliquable, placer dans son titre un lien portant la classe `stretched-link`.
 */
export function Card({
  children,
  as: Tag = 'div',
  interactive = false,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  as?: 'div' | 'article' | 'li';
  interactive?: boolean;
  tone?: CardTone;
  className?: string;
}) {
  return (
    <Tag
      data-tone={tone === 'inverse' ? 'inverse' : undefined}
      className={cn(
        'rounded-card relative border p-6 shadow-xs',
        TONES[tone],
        interactive && cn(INTERACTIVE, FOCUS_RING[tone]),
        className,
      )}
    >
      {children}
    </Tag>
  );
}
