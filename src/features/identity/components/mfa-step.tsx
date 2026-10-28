'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconKey, IconShield } from '@/components/ui/icons';
import { type MfaMethod, verifyMfa } from '@/features/identity/api';
import { describeError, errorText, type ErrorView } from '@/features/identity/errors';
import { cleanRecoveryCode, isRecoveryCodeComplete } from '@/features/identity/recovery-codes';
import type { MfaChallenge, MfaSession } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';

const CODE_ID = 'double-authentification-code';

/**
 * Seconde étape d'un compte déjà configuré : code de l'application d'authentification, ou, en lien
 * secondaire, un code de récupération (consommé). Jamais de code de secours par SMS (ADR-023).
 */
export function MfaStep({
  challenge,
  onVerified,
  onFailure,
}: {
  challenge: MfaChallenge;
  onVerified: (session: MfaSession, method: MfaMethod) => void;
  /** Étape impossible à poursuivre (jeton expiré, trop d'essais, compte refusé). */
  onFailure: (view: ErrorView) => void;
}) {
  const t = identityTexts.mfa;
  const canUseRecovery = challenge.methods.includes('recovery_code');
  const [method, setMethod] = useState<MfaMethod>('totp');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const recovery = method === 'recovery_code';

  // Arrivée sur l'écran, ou changement de méthode : le champ reçoit le focus.
  useEffect(() => {
    codeRef.current?.focus();
  }, [method]);

  function switchMethod() {
    setMethod(recovery ? 'totp' : 'recovery_code');
    setCode('');
    setCodeError(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setCodeError(null);
    const complete = recovery ? isRecoveryCodeComplete(code) : /^\d{6}$/.test(code);
    if (!complete) {
      setCodeError(recovery ? t.recoveryInvalid : t.codeInvalid);
      codeRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      onVerified(await verifyMfa(challenge.mfaToken, method, code), method);
    } catch (caught) {
      const view = describeError(caught);
      if (view.restartNeeded || view.denied) {
        onFailure(view);
      } else if (view.field === 'mfaCode') {
        setCodeError(view.message);
        setCode('');
        codeRef.current?.focus();
      } else {
        setError(errorText(view));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="mfa-titre" className="swap-in">
      <Heading as="h1" size="h3" id="mfa-titre" className="sm:text-[1.75rem]">
        {recovery ? t.recoveryTitle : t.title}
      </Heading>
      <p className="text-ink-muted mt-3">{recovery ? t.recoveryIntro : t.intro}</p>
      <form noValidate onSubmit={submit} className="mt-8 grid gap-5">
        {recovery ? (
          <TextField
            key="recovery"
            id={CODE_ID}
            inputRef={codeRef}
            label={t.recoveryLabel}
            hint={t.recoveryHint}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={11}
            value={code}
            onChange={(event) => setCode(cleanRecoveryCode(event.target.value))}
            error={codeError}
            inputClassName="max-w-64 text-center font-mono text-lg tracking-widest uppercase"
          />
        ) : (
          <TextField
            key="totp"
            id={CODE_ID}
            inputRef={codeRef}
            label={t.codeLabel}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            error={codeError}
            inputClassName="max-w-56 text-center text-xl tracking-[0.3em] tabular-nums"
          />
        )}
        <FormMessage>{error}</FormMessage>
        <Button type="submit" size="lg" aria-busy={pending || undefined}>
          {pending ? t.submitting : t.submit}
        </Button>
        {canUseRecovery ? (
          <Button
            variant="ghost"
            onClick={switchMethod}
            // Libellé long sur téléphone : il passe à la ligne au lieu de déborder de la carte.
            className="max-w-full justify-self-start py-2 text-left whitespace-normal!"
          >
            {recovery ? <IconShield /> : <IconKey />}
            {recovery ? t.useApp : t.useRecovery}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
