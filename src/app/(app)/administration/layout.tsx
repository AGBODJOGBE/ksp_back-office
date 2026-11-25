import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { accountTexts } from '@/features/identity/accounts';
import { AdministrationTabs } from './administration-tabs';

const LABEL = accountTexts.module;

export const metadata: Metadata = { title: { template: `%s · ${LABEL}`, default: LABEL } };

/**
 * Module « Administration » : coque statique ; les écrans (comptes, rôles) sont des feuilles client
 * chargées à la demande qui lisent la gateway (F-005, option A).
 */
export default function AdministrationLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="administration" label={LABEL}>
      <Eyebrow>{LABEL}</Eyebrow>
      <div className="mt-4">
        <AdministrationTabs />
      </div>
      <div className="mt-8">{children}</div>
    </ModuleGate>
  );
}
