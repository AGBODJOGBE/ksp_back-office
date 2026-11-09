import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ModuleGate } from '@/components/layout/module-gate';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SubNav } from '@/components/ui/sub-nav';
import { notificationPaths, notificationTexts } from '@/features/notification';

const LABEL = notificationTexts.title;

export const metadata: Metadata = { title: { template: `%s · ${LABEL}`, default: LABEL } };

/**
 * Module Notifications (ADR-039) : coque statique commune (surtitre, onglets) ; chaque écran est une
 * feuille client chargée à la demande qui lit la gateway (F-005, option A). Les deux onglets ont les
 * mêmes rôles (`super_admin`, `support_agent`) : pas de filtre par rôle.
 */
export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGate slug="notifications" label={LABEL}>
      <Eyebrow>{LABEL}</Eyebrow>
      <div className="mt-4">
        <SubNav
          label="Sections des notifications"
          items={[
            { href: notificationPaths.deliveries, label: notificationTexts.deliveries.title },
            { href: notificationPaths.templates, label: notificationTexts.templates.title },
          ]}
        />
      </div>
      <div className="mt-8">{children}</div>
    </ModuleGate>
  );
}
