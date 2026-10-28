import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { CleaningTabs, cleaningTexts } from '@/features/cleaning';

export const metadata: Metadata = {
  title: { template: `%s · ${cleaningTexts.module}`, default: cleaningTexts.module },
};

/**
 * Module Nettoyage : coque statique commune (surtitre et onglets filtrés par rôle) ; chaque écran est
 * une feuille client qui lit la gateway (F-005, option A). Hors des rôles de l'agent, `ModuleGate`
 * affiche un message à la place du module (affichage seulement).
 */
export default function CleaningLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="nettoyage" label={cleaningTexts.module}>
      <Eyebrow>{cleaningTexts.module}</Eyebrow>
      <div className="mt-4">
        <CleaningTabs />
      </div>
      <div className="mt-8">{children}</div>
    </ModuleGate>
  );
}
