import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/cn';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Texte alternatif : à fournir uniquement si l'icône porte un sens sans texte visible à côté. */
  title?: string;
};

/**
 * Base commune des icônes : trait de 1,75 sur une grille de 24, couleur héritée du texte.
 * Décorative par défaut (masquée aux lecteurs d'écran) ; avec `title`, elle devient une image nommée.
 */
export function Icon({ title, className, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}
