import { SUPER_ADMIN } from '@/config/modules';
import { visibleModules } from '@/lib/navigation/visible-modules';

/**
 * Tableau de bord provisoire : présentation des modules de la phase en cours.
 * Les indicateurs de chaque métier remplaceront ces cartes quand les services les exposeront.
 */
export function DashboardOverview() {
  const modules = visibleModules([SUPER_ADMIN]).filter((module) => module.slug !== 'tableau-de-bord');
  return (
    <>
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="text-ink-muted mt-2">
        Indicateurs de chaque métier, tâches du jour et alertes : ils s&apos;afficheront ici selon vos rôles.
      </p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <li key={module.slug} className="border-line bg-surface rounded-card border p-5">
            <h2 className="font-semibold">{module.label}</h2>
            <p className="text-ink-muted mt-2 text-sm">{module.description}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
