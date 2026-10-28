import Link from 'next/link';
import { cn } from '@/lib/cn';
import { WeaveMark } from './weave';

/**
 * Logo provisoire : emblème tissé + mot « KSP » dans la police de titres, suivi du nom du site.
 * À remplacer par le logo officiel du groupe dès qu'il est fourni.
 *
 * Repris du portail (F-016) ; seul ajout : le lien, son nom accessible et le mot qui suit « KSP »
 * sont des propriétés, pour que le même composant serve chaque site (futur ksp-ui).
 */
export function Logo({
  href = '/',
  label = 'KSP, accueil',
  suffix = 'Groupe',
  className,
}: {
  href?: string;
  /** Nom accessible du lien (le texte visible est masqué aux lecteurs d'écran). */
  label?: string;
  /** Mot affiché après « KSP » : « Groupe » sur le portail, « Back-office » ici. */
  suffix?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'group/logo text-ink inline-flex min-h-11 items-center gap-2.5 rounded-md pr-1',
        'font-display text-[1.375rem] leading-none font-bold tracking-tight',
        className,
      )}
    >
      <WeaveMark className="ease-soft size-8 transition-transform duration-(--motion-slow) group-hover/logo:rotate-90" />
      <span aria-hidden="true">KSP</span>
      <span aria-hidden="true" className="text-eyebrow text-ink-subtle font-sans font-semibold uppercase">
        {suffix}
      </span>
    </Link>
  );
}
