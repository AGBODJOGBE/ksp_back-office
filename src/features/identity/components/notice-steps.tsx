'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { IconAlert, IconArrowLeft } from '@/components/ui/icons';
import { identityTexts } from '@/features/identity/texts';

/** Titre qui reçoit le focus à l'arrivée sur l'écran, pour que son message soit lu. */
function FocusedTitle({ id, children }: { id: string; children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <Heading as="h1" size="h3" id={id} className="sm:text-[1.75rem]">
      <span ref={ref} tabIndex={-1} className="focus:outline-none">
        {children}
      </span>
    </Heading>
  );
}

/**
 * Le backend refuse ce compte au back-office (`IDENTITY_BACKOFFICE_FORBIDDEN`, compte suspendu) :
 * son message est affiché tel quel, sans rien deviner de plus.
 */
export function DeniedStep({ message, onOtherNumber }: { message: string; onOtherNumber: () => void }) {
  const t = identityTexts.denied;
  return (
    <section aria-labelledby="refus-titre" className="swap-in">
      <span className="bg-danger-soft text-danger grid size-12 place-items-center rounded-full">
        <IconAlert className="size-6" />
      </span>
      <div className="mt-5">
        <FocusedTitle id="refus-titre">{t.title}</FocusedTitle>
      </div>
      <p className="text-ink mt-3 font-medium">{message}</p>
      <p className="text-ink-muted mt-3">{t.advice}</p>
      <Button variant="secondary" size="lg" onClick={onOtherNumber} className="mt-8 w-full">
        <IconArrowLeft />
        {t.otherNumber}
      </Button>
    </section>
  );
}

/**
 * Après une connexion par code de récupération, ou quand il en reste peu : le nombre de codes restants
 * (`recoveryCodesRemaining`, contrat : « le back-office prévient quand il en reste peu »).
 */
export function RemainingCodesStep({
  remaining,
  usedRecoveryCode,
  onContinue,
}: {
  remaining: number;
  usedRecoveryCode: boolean;
  onContinue: () => void;
}) {
  const t = identityTexts.remaining;
  return (
    <section aria-labelledby="restants-titre" className="swap-in">
      <FocusedTitle id="restants-titre">{t.title}</FocusedTitle>
      {usedRecoveryCode ? <p className="text-ink-muted mt-3">{t.used}</p> : null}
      <p className="rounded-control border-warning bg-warning-soft text-warning mt-4 flex items-start gap-2 border p-4 font-semibold">
        <IconAlert className="mt-0.5 size-5" />
        <span>{t.count(remaining)}</span>
      </p>
      <p className="text-ink-muted mt-4">{t.advice}</p>
      <Button size="lg" onClick={onContinue} className="mt-8 w-full">
        {t.continue}
      </Button>
    </section>
  );
}
