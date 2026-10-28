'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { IconArrowRight } from '@/components/ui/icons';
import { ModuleIcon } from '@/components/layout/module-icon';
import type { BackofficeModule } from '@/config/modules';
import { useSession } from '@/lib/api/session';
import { visibleModules } from '@/lib/navigation/visible-modules';

/**
 * Cartes des modules ouverts à l'agent, selon les rôles de sa session (affichage seulement : la gateway
 * reste seule juge des droits). Sans rôle métier, un message l'explique au lieu d'une liste vide.
 */
export function ModuleCards({ modules }: { modules: readonly BackofficeModule[] }) {
  const current = useSession();
  if (!current) return null;
  const open = visibleModules(current.roles, undefined, modules).filter(
    (item) => item.slug !== 'tableau-de-bord',
  );

  if (!open.length) {
    return (
      <p className="border-line bg-surface rounded-card text-ink-muted mt-8 max-w-2xl border p-6">
        Aucun module de la phase en cours n&apos;est ouvert à vos rôles. Si vous en avez besoin, demandez à un
        administrateur de vous attribuer le rôle correspondant.
      </p>
    );
  }

  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {open.map((item) => (
        <Card as="li" key={item.slug} interactive className="flex flex-col">
          <span className="bg-accent-soft text-accent-ink rounded-control grid size-11 place-items-center">
            <ModuleIcon slug={item.slug} className="size-[1.375rem]" />
          </span>
          <Link
            href={`/${item.slug}`}
            className="stretched-link font-display text-ink mt-4 flex items-center justify-between gap-2 text-lg font-semibold focus-visible:outline-none"
          >
            {item.label}
            <IconArrowRight className="text-ink-subtle group-hover/card:text-accent-ink size-5 transition-colors" />
          </Link>
          <p className="text-small text-ink-muted mt-2">{item.description}</p>
        </Card>
      ))}
    </ul>
  );
}
