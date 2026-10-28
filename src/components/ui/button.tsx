import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'inverse' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'icon';

/*
 * Survol : un voile (pseudo-élément) apparaît en fondu ; appui : léger enfoncement.
 * Seuls `opacity` et `transform` sont animés.
 */
const BASE = cn(
  'group/button relative isolate inline-flex items-center justify-center gap-2 overflow-hidden',
  'rounded-control font-semibold whitespace-nowrap select-none',
  'transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98]',
  'before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity',
  'before:duration-(--motion-base) before:ease-soft hover:before:opacity-100',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:before:opacity-0',
);

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand before:bg-brand-strong',
  accent: 'bg-accent text-on-accent before:bg-accent-strong',
  secondary: 'border border-line-strong bg-surface text-ink before:bg-surface-sunken',
  ghost: 'text-ink before:bg-surface-sunken',
  inverse: 'bg-white text-brand-900 before:bg-brand-100',
  // Action destructrice confirmée (refus, annulation, désactivation) : voile sombre au survol.
  danger: 'bg-danger text-white before:bg-black/15',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-5 text-[0.9375rem]',
  lg: 'min-h-13 px-7 text-base',
  icon: 'size-11',
};

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize };

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: StyleProps & { className?: string }): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & StyleProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/** Icône qui glisse au survol du bouton parent (flèche placée après le libellé). */
export function ButtonArrow({ children }: { children: ReactNode }) {
  return (
    <span className="ease-soft transition-transform duration-(--motion-base) group-hover/button:translate-x-0.5">
      {children}
    </span>
  );
}
