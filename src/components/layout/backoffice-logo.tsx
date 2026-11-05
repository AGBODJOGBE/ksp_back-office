import Link from 'next/link';
import { LogoMark } from '@/components/ui/brand/logo';
import { cn } from '@/lib/cn';

/**
 * Logo du back-office : le logo du groupe (version horizontale, `components/ui/brand/logo.tsx`, identique
 * au portail) suivi du nom de l'outil. Sur fond bleu nuit (`data-tone="inverse"`), le logo passe de
 * lui-même en version claire.
 */
export function BackofficeLogo({
  href,
  label,
  className,
}: {
  href: string;
  /** Nom accessible du lien (le logo et le texte visible sont masqués aux lecteurs d'écran). */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn('group/logo inline-flex min-h-11 items-center gap-3 rounded-md pr-1', className)}
    >
      <LogoMark
        variant="horizontal"
        className="ease-soft h-7 w-auto transition-transform duration-(--motion-base) group-active/logo:scale-[0.98]"
      />
      <span
        aria-hidden="true"
        className="text-small text-ink-muted border-line-strong border-l pl-3 font-semibold whitespace-nowrap"
      >
        Back-office
      </span>
    </Link>
  );
}
