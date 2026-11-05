import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BackofficeLogo } from '@/components/layout/backoffice-logo';
import { LogoMark } from '@/components/ui/brand/logo';
import { SignatureBackdrop, SignatureRule } from '@/components/ui/brand/signature';
import { Card } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Heading } from '@/components/ui/heading';
import { IconCheck } from '@/components/ui/icons';
import { siteConfig } from '@/config/site';
import { identityTexts, LoginFlow } from '@/features/identity';

export const metadata: Metadata = { title: 'Connexion' };

const LOGO = { href: '/connexion', label: `${siteConfig.name}, connexion` } as const;

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
        <SignatureBackdrop className="absolute inset-0 -z-10 size-full [mask-image:linear-gradient(to_top,black,transparent_60%)] opacity-[0.07]" />
        <div className="grid justify-items-start gap-6">
          <LogoMark title="Groupe KSP" className="h-auto w-44 xl:w-52" />
          <p className="text-eyebrow text-ink-muted font-semibold uppercase">Back-office</p>
        </div>
        <div className="max-w-md">
          <Eyebrow>{identityTexts.login.eyebrow}</Eyebrow>
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
        <div className="grid gap-4">
          <SignatureRule size="md" className="max-w-xs" />
          <p className="text-small text-ink-subtle">{siteConfig.domain}</p>
        </div>
      </aside>

      <main
        id="contenu"
        tabIndex={-1}
        className="flex min-w-0 flex-col px-4 py-6 focus:outline-none sm:px-8 sm:py-10"
      >
        <div className="grid gap-3 lg:hidden">
          <BackofficeLogo {...LOGO} className="justify-self-start" />
          <SignatureRule />
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
