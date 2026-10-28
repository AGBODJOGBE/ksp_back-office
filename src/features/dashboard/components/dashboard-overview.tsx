import { Eyebrow } from '@/components/ui/eyebrow';
import { Heading } from '@/components/ui/heading';
import type { BackofficeModule } from '@/config/modules';
import { ModuleCards } from './module-cards';

/**
 * Tableau de bord : en attendant les indicateurs des services, les modules ouverts à l'agent.
 * Coque serveur ; la liste filtrée par rôle est une feuille client qui lit la session.
 */
export function DashboardOverview({ modules }: { modules: readonly BackofficeModule[] }) {
  return (
    <>
      <Eyebrow>Tableau de bord</Eyebrow>
      <Heading as="h1" size="h2" className="mt-3">
        Bienvenue dans le back-office
      </Heading>
      <p className="text-ink-muted max-w-reading mt-3">
        Indicateurs de chaque métier, tâches du jour et alertes : ils s&apos;afficheront ici selon vos rôles,
        à mesure que les services seront livrés. En attendant, voici les modules qui vous sont ouverts.
      </p>
      <ModuleCards modules={modules} />
    </>
  );
}
