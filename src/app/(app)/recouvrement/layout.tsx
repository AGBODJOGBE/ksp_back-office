import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { RecoveryTabs, recoveryTexts } from '@/features/recovery';

export const metadata: Metadata = {
  title: { template: `%s · ${recoveryTexts.module}`, default: recoveryTexts.module },
};

/**
 * Module Recouvrement : coque statique commune (surtitre et onglets filtrés par rôle) ; chaque écran est
 * une feuille client chargée à la demande qui lit la gateway. Hors des rôles de l'agent, `ModuleGate`
 * affiche un message à la place du module (affichage seulement).
 */
export default function RecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="recouvrement" label={recoveryTexts.module}>
      <Eyebrow>{recoveryTexts.module}</Eyebrow>
      <div className="mt-4">
        <RecoveryTabs />
      </div>
      <div className="mt-8">{children}</div>
    </ModuleGate>
  );
}
