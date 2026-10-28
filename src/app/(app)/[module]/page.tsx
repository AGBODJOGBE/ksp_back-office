import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Heading } from '@/components/ui/heading';
import { Placeholder } from '@/components/ui/placeholder';
import { ModuleGate } from '@/components/layout/module-gate';
import { MODULES } from '@/config/modules';
import { waitingModules } from '@/lib/navigation/visible-modules';

type Params = Promise<{ module: string }>;

/** Modules sans écrans encore : ceux qui ont leur propre route (Nettoyage…) n'ont pas de page d'attente. */
const available = () => waitingModules();

/** Seuls les modules de la phase en cours ont une page : toute autre adresse répond 404, sans rendu à la demande. */
export const dynamicParams = false;

export function generateStaticParams() {
  return available().map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { module: slug } = await params;
  return { title: MODULES.find((module) => module.slug === slug)?.label };
}

/**
 * Page d'attente d'un module : remplacée par ses écrans lors du lot qui le livre. Hors des rôles de
 * l'agent (adresse saisie à la main), un message remplace le module.
 */
export default async function ModulePage({ params }: { params: Params }) {
  const { module: slug } = await params;
  const current = available().find((item) => item.slug === slug);
  if (!current) notFound();
  return (
    <ModuleGate slug={current.slug} label={current.label}>
      <Eyebrow>Module</Eyebrow>
      <Heading as="h1" size="h2" className="mt-3">
        {current.label}
      </Heading>
      <p className="text-ink-muted max-w-reading mt-3">{current.description}</p>
      <Placeholder title="Écrans en préparation" className="mt-8 max-w-2xl">
        Ce module affichera ses écrans quand le service correspondant sera livré par la gateway.
        <span className="mt-3 block">
          Rôles concernés :{' '}
          {current.roles.map((role) => (
            <code key={role} className="bg-surface-sunken text-ink mr-2 rounded px-1.5 py-0.5 text-xs">
              {role}
            </code>
          ))}
        </span>
      </Placeholder>
    </ModuleGate>
  );
}
