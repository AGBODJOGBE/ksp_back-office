import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { organizationTexts } from '@/features/identity/organizations';

const LABEL = organizationTexts.module;

export const metadata: Metadata = { title: { template: `%s · ${LABEL}`, default: LABEL } };

/**
 * Module « Clients et comptes » : coque statique ; les écrans (comptes entreprise aujourd'hui) sont des
 * feuilles client chargées à la demande qui lisent la gateway (F-005, option A).
 */
export default function ClientsLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="clients" label={LABEL}>
      <Eyebrow>{LABEL}</Eyebrow>
      <div className="mt-6">{children}</div>
    </ModuleGate>
  );
}
