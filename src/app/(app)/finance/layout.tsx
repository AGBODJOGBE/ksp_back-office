import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { FinanceTabs } from './finance-tabs';

const LABEL = 'Finance';

export const metadata: Metadata = { title: { template: `%s · ${LABEL}`, default: LABEL } };

/**
 * Module Finance : coque statique commune (surtitre et onglets filtrés par rôle) ; chaque écran est une
 * feuille client chargée à la demande qui lit la gateway (F-005, option A).
 */
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="finance" label={LABEL}>
      <Eyebrow>{LABEL}</Eyebrow>
      <div className="mt-4">
        <FinanceTabs />
      </div>
      <div className="mt-8">{children}</div>
    </ModuleGate>
  );
}
