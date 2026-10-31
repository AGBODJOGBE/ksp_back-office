import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@/components/ui/icons';

/** Lien de retour vers la liste, au-dessus du titre d'une fiche. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-small text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-2 font-semibold"
    >
      <IconArrowLeft className="size-4" />
      {children}
    </Link>
  );
}
