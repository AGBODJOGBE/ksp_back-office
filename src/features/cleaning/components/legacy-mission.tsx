import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { cleaningPaths } from '@/features/cleaning/paths';
import { cleaningTexts } from '@/features/cleaning/texts';

const t = cleaningTexts.legacyMission;

/**
 * Ancienne fiche « mission » (v1), encore citée par les factures, les paiements et les portefeuilles
 * (`cleaning_mission`). Le contrat n'établit aucune correspondance entre une mission v1 et un
 * programme v2 (ADR-054 : base du Nettoyage recréée ; ADR-055 : objets payés « mission » remplacés) :
 * pas de redirection, une page sobre qui renvoie vers les programmes (à valider). Composant serveur.
 */
export function LegacyMission({ id }: { id: string }) {
  return (
    <div className="grid gap-4">
      <Heading as="h1" size="h2">
        {t.title}
      </Heading>
      <p className="text-ink max-w-reading">{t.lead}</p>
      <p className="text-small text-ink-muted break-all">{t.reference(id)}</p>
      <p className="text-ink-muted max-w-reading">{t.hint}</p>
      <ButtonLink href={cleaningPaths.programs} variant="secondary" className="justify-self-start">
        {t.back}
      </ButtonLink>
    </div>
  );
}
