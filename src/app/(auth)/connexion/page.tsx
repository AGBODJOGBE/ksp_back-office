import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Logo } from '@/components/ui/brand/logo';
import { WeavePattern } from '@/components/ui/brand/weave';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Heading } from '@/components/ui/heading';
import { IconCheck } from '@/components/ui/icons';
import { siteConfig } from '@/config/site';
import { identityTexts, LoginFlow } from '@/features/identity';

export const metadata: Metadata = { title: 'Connexion' };

const LOGO = { href: '/connexion', label: `${siteConfig.name}, connexion`, suffix: 'Back-office' } as const;

const PROMISES = [
  'Double authentification obligatoire, avec votre application d’authentification.',
  'Session de 12 heures au plus, fermée après 30 minutes sans activité.',
  'Vous ne voyez que les modules de vos rôles.',
];

/**
 * Connexion des agents : coque statique, parcours dans un composant client (F-005, option A) —
 * téléphone, code reçu, puis double authentification (ADR-023).
 */
export default function LoginPage() {
  return (
    <div className="bg-canvas grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside
        data-tone="inverse"
        className="relative isolate hidden flex-col justify-between overflow-hidden p-12 lg:sticky lg:top-0 lg:flex lg:h-dvh xl:p-16"
      >
        <WeavePattern className="text-accent absolute inset-0 -z-10 h-full w-full [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-15" />
        <Logo {...LOGO} />
        <div className="max-w-md">
          <Eyebrow className="text-accent-ink">{identityTexts.login.eyebrow}</Eyebrow>
          <Heading as="p" size="h2" className="mt-4">
            {siteConfig.tagline}
          </Heading>
          <ul className="text-ink-muted mt-8 grid gap-4">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex gap-3">
                <IconCheck className="text-accent-ink mt-0.5" />
                <span>{promise}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-ink-subtle">{siteConfig.domain}</p>
      </aside>

      <main
        id="contenu"
        tabIndex={-1}
        className="flex min-w-0 flex-col px-4 py-6 focus:outline-none sm:px-8 sm:py-10"
      >
        <div className="lg:hidden">
          <Logo {...LOGO} />
        </div>
        <div className="mx-auto my-auto w-full max-w-[30rem] py-8">
          <Card className="p-5 sm:p-8">
            {/* Lecture de ?retour= : sous Suspense pour garder la page statique. */}
            <Suspense
              fallback={
                <p role="status" className="text-ink-muted">
                  {identityTexts.login.checking}
                </p>
              }
            >
              <LoginFlow />
            </Suspense>
          </Card>
        </div>
      </main>
    </div>
  );
}
