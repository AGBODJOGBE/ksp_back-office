import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Surtitre éditorial : capitales espacées, précédées du losange de la signature KSP. */
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
        'text-eyebrow text-accent-ink inline-flex items-center gap-2.5 font-semibold uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className="bg-accent size-1.5 shrink-0 rotate-45" />
      {children}
    </Tag>
  );
}
