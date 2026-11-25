import { ButtonLink } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Placeholder } from '@/components/ui/placeholder';
import { recoveryPaths } from '@/features/recovery/paths';
import { recoveryTexts } from '@/features/recovery/texts';

const t = recoveryTexts.pending;

/**
 * Écran provisoire d'une section livrée par le sous-lot 4b (dossiers, fiche dossier, paiements hors
 * ligne) : aucune donnée, un message et un retour au tableau de bord. Composant serveur, remplacé par
 * l'écran réel.
 */
export function PendingScreen({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-6">
      <Heading as="h1" size="h2">
        {title}
      </Heading>
      <Placeholder title={t.title} className="max-w-2xl">
        {text}
      </Placeholder>
      <ButtonLink href={recoveryPaths.home} variant="secondary" className="justify-self-start">
        {t.back}
      </ButtonLink>
    </div>
  );
}
