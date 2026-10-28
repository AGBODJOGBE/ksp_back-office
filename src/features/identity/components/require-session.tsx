'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { getDictionary } from '@/i18n';
import { session, type SessionEnd, useSession } from '@/lib/api';
import { describeError, errorText } from '@/features/identity/errors';
import { LOGIN_PATH, loginHref } from '@/features/identity/return-path';
import { identityTexts } from '@/features/identity/texts';

type Phase = 'checking' | 'redirecting' | 'ready';

/** Page demandée, recherche comprise, pour y revenir après la connexion. */
function currentPath(pathname: string): string {
  return typeof window === 'undefined' ? pathname : `${pathname}${window.location.search}`;
}

/** Attente de la session : squelette de page (titre, texte), sans décalage à l'arrivée du contenu. */
function PageSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="grid gap-4">
        <span className="bg-surface-sunken h-3 w-28 animate-pulse rounded-full" />
        <span className="bg-surface-sunken rounded-control h-10 w-2/3 max-w-md animate-pulse" />
        <span className="bg-surface-sunken h-4 w-full max-w-2xl animate-pulse rounded-full" />
        <span className="bg-surface-sunken h-4 w-5/6 max-w-xl animate-pulse rounded-full" />
      </div>
    </div>
  );
}

function Status({ children }: { children: string }) {
  return (
    <p role="status" className="text-ink-muted">
      {children}
    </p>
  );
}

/**
 * Garde des pages de l'espace `(app)`. Au chargement : session en mémoire, sinon renouvellement
 * silencieux (cookie posé par la gateway). Sans session : direction la connexion, avec retour ici
 * ensuite. Session terminée pendant la visite (12 h atteintes, 30 min sans activité, accès retiré) :
 * explication et lien pour se reconnecter.
 *
 * Le backend reste seul juge des droits : cette garde évite seulement d'afficher un espace vide.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const t = identityTexts.guard;
  const { replace } = useRouter();
  const pathname = usePathname();
  const current = useSession();
  const [phase, setPhase] = useState<Phase>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    session.restore().then((result) => {
      if (!active) return;
      if (result.status === 'anonymous') {
        setPhase('redirecting');
        replace(loginHref(currentPath(pathname)));
        return;
      }
      setPhase('ready');
    });
    return () => {
      active = false;
    };
  }, [attempt, pathname, replace]);

  if (current) return <>{children}</>;
  if (phase === 'checking') return <PageSkeleton label={t.loading} />;
  if (phase === 'redirecting') return <Status>{t.redirecting}</Status>;

  // Raison de la fin : écrite par le magasin en même temps que la session disparaît (même rendu).
  const end: SessionEnd | null = session.ended();
  const retry = () => {
    setPhase('checking');
    setAttempt((value) => value + 1);
  };

  switch (end?.reason) {
    case 'logout':
      return <Status>{t.signingOut}</Status>;
    case 'unavailable':
      return (
        <div className="grid justify-items-start gap-5">
          <FormMessage>{`${t.unavailable} ${errorText(describeError(end.error))}`}</FormMessage>
          <Button onClick={retry}>{getDictionary().common.retry}</Button>
        </div>
      );
    case 'forbidden':
      return <Ended title={t.forbiddenTitle} text={end.error.message} href={LOGIN_PATH} label={t.signIn} />;
    default:
      return (
        <Ended
          title={t.expiredTitle}
          text={t.expiredText}
          href={loginHref(currentPath(pathname))}
          label={t.signIn}
        />
      );
  }
}

function Ended({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return (
    <div className="max-w-reading">
      <Heading as="h1" size="h2">
        {title}
      </Heading>
      <p className="text-ink-muted mt-3">{text}</p>
      <ButtonLink href={href} size="lg" className="mt-6">
        {label}
      </ButtonLink>
    </div>
  );
}
