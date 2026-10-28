import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type HeadingSize = 'display' | 'h1' | 'h2' | 'h3';

const SIZES: Record<HeadingSize, string> = {
  display: 'text-display font-semibold',
  h1: 'text-h1 font-semibold',
  h2: 'text-h2 font-semibold',
  h3: 'text-h3 font-semibold',
};

/** Titre dans la police de la charte. Le niveau (`as`) suit la structure de la page, la taille suit le design. */
export function Heading({
  children,
  as: Tag = 'h2',
  size = 'h2',
  id,
  className,
}: {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p';
  size?: HeadingSize;
  id?: string;
  className?: string;
}) {
  return (
    <Tag id={id} className={cn('font-display text-ink', SIZES[size], className)}>
      {children}
    </Tag>
  );
}
