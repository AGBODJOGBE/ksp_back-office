import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Placeholder } from '@/components/ui/placeholder';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';

const t = cleaningTexts.comingSoon;

/**
 * Écran provisoire d'une section du parcours v2 dont les écrans arrivent dans un sous-lot suivant
 * (1b : dossiers et visites ; 1c : planning, programmes, agents, réclamations). Composant serveur,
 * aucune donnée : il dit seulement ce qui viendra ici.
 */
export function ComingSoon({ title, lead, coming }: { title: string; lead: string; coming: string }) {
  return (
    <div className="grid gap-6">
      <div>
        <Heading as="h1" size="h2">
          {title}
        </Heading>
        <p className="text-ink-muted max-w-reading mt-2">{lead}</p>
      </div>
      <Placeholder title={t.badge} className="max-w-reading">
        {coming}
      </Placeholder>
      <ButtonLink href={cleaningPaths.catalog.home} variant="secondary" className="justify-self-start">
        {t.back}
      </ButtonLink>
    </div>
  );
}
