'use client';

import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { getDictionary } from '@/i18n';
// Import direct du magasin de session : ni configuration ni zod pour ce composant.
import { useSession } from '@/lib/api/session';
import { isModuleVisible } from '@/lib/navigation/visible-modules';

/**
 * Page d'un module ouverte par son adresse alors qu'il n'est pas dans le menu de l'agent : un message
 * l'explique au lieu d'afficher le module. Simple confort d'affichage, comme le menu : la gateway refuse
 * de toute façon les données d'un module hors des rôles de l'agent.
 */
export function ModuleGate({ slug, label, children }: { slug: string; label: string; children: ReactNode }) {
  const t = getDictionary();
  const current = useSession();
  if (!current) return null;
  if (isModuleVisible(slug, current.roles)) return <>{children}</>;
  return (
    <div className="max-w-reading">
      <Heading as="h1" size="h2">
        {t.shell.moduleClosedTitle(label)}
      </Heading>
      <p className="text-ink-muted mt-3">{t.shell.moduleClosedText}</p>
      <ButtonLink href="/" size="lg" className="mt-6">
        {t.common.backHome}
      </ButtonLink>
    </div>
  );
}
