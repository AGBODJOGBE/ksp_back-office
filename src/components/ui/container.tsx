import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIZES = {
  page: 'max-w-page',
  reading: 'max-w-reading',
} as const;

/** Largeur de lecture centrée, avec les marges latérales de la charte (fluides, de 16 à 32 px). */
export function Container({
  children,
  className,
  size = 'page',
}: {
  children: ReactNode;
  className?: string;
  size?: keyof typeof SIZES;
}) {
  return <div className={cn('px-gutter mx-auto w-full', SIZES[size], className)}>{children}</div>;
}
