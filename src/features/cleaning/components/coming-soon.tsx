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
export function ComingSoon({
  title,
  lead,
  coming,
  back = { href: cleaningPaths.catalog.home, label: t.back },
}: {
  title: string;
  lead: string;
  coming: string;
  /** Lien de retour (par défaut : le catalogue). */
  back?: { href: string; label: string };
}) {
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
      <ButtonLink href={back.href} variant="secondary" className="justify-self-start">
        {back.label}
      </ButtonLink>
    </div>
  );
}
