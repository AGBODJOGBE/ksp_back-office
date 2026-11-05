import { Eyebrow } from '@/components/ui/eyebrow';
import { Heading } from '@/components/ui/heading';
import type { BackofficeModule } from '@/config/modules';
import { dashboardTexts as t } from '@/features/dashboard/texts';
import { DayQueue } from './day-queue-lazy';
import { ModuleCards } from './module-cards';

/**
 * « Ma journée » : la file « À traiter » (sections selon les rôles, chargée à la demande), puis les
 * modules ouverts à l'agent. Coque serveur ; la file et les cartes sont des feuilles client qui lisent
 * la session.
 */
export function DashboardOverview({ modules }: { modules: readonly BackofficeModule[] }) {
  return (
    <>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <Heading as="h1" size="h2" className="mt-3">
        {t.title}
      </Heading>
      <p className="text-ink-muted max-w-reading mt-3">{t.lead}</p>
      <div className="mt-8">
        <DayQueue />
      </div>
      <section aria-labelledby="vos-modules" className="mt-12">
        <Heading as="h2" size="h3" id="vos-modules">
          {t.modulesTitle}
        </Heading>
        <ModuleCards modules={modules} />
      </section>
    </>
  );
}
