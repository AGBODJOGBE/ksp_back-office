import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AccountPanel, RequireSession } from '@/features/identity/session';

/**
 * Espace des agents : cadre statique (menu filtré par rôle, compte) et contenu affiché seulement
 * une fois la session reprise. Sans session : retour à la connexion, puis à la page demandée.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell account={<AccountPanel />}>
      <RequireSession>{children}</RequireSession>
    </AppShell>
  );
}
