'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { IconArrowLeft } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { requestOtp, verifyOtp, type VerifyOtpResult } from '@/features/identity/api';
import { useCountdown } from '@/features/identity/countdown';
import { describeError, errorText } from '@/features/identity/errors';
import { cleanCode, isCodeComplete } from '@/features/identity/phone';
import type { OtpChallenge } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';

const CODE_ID = 'connexion-code';

/**
 * Étape 2 : saisie du code reçu. Renvoi possible après le délai annoncé par la gateway
 * (`resendAfterSeconds`, ou `retryAfterSeconds` d'une limite atteinte).
 */
export function CodeStep({
  phone,
  challenge: initialChallenge,
  onVerified,
  onDenied,
  onChangeNumber,
}: {
  phone: string;
  challenge: OtpChallenge;
  /** Code accepté : étape de double authentification (compte interne), ou session directe. */
  onVerified: (result: VerifyOtpResult) => void;
  /** Le backend refuse ce compte au back-office (aucun rôle, compte suspendu). */
  onDenied: (message: string) => void;
  onChangeNumber: () => void;
}) {
  const t = identityTexts.login;
  const [challenge, setChallenge] = useState(initialChallenge);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newCodeNeeded, setNewCodeNeeded] = useState(false);
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const resend = useCountdown();
  const { start } = resend;

  // Arrivée sur l'écran : le clavier numérique s'ouvre, le message d'envoi est lu avec le champ.
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  useEffect(() => {
    start(initialChallenge.resendAfterSeconds);
  }, [initialChallenge, start]);

  function fail(caught: unknown) {
    const view = describeError(caught);
    if (view.denied) return onDenied(view.message);
    if (view.retryAfterSeconds) resend.start(view.retryAfterSeconds);
    if (view.newCodeNeeded) {
      setNewCodeNeeded(true);
      resend.start(0);
    }
    if (view.field === 'code') {
      setCodeError(view.message);
      setCode('');
      codeRef.current?.focus();
    } else {
      setError(errorText(view));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || newCodeNeeded) return;
    setError(null);
    setInfo(null);
    setCodeError(null);
    if (!isCodeComplete(code)) {
      setCodeError(t.codeInvalid);
      codeRef.current?.focus();
      return;
    }
    setPending('verify');
    try {
      onVerified(await verifyOtp(challenge.challengeId, code));
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(null);
    }
  }

  async function sendAgain() {
    if (pending || resend.remaining > 0) return;
    setError(null);
    setInfo(null);
    setCodeError(null);
    setPending('resend');
    try {
      const next = await requestOtp(phone);
      setChallenge(next);
      setCode('');
      setNewCodeNeeded(false);
      resend.start(next.resendAfterSeconds);
      setInfo(t.resent);
      codeRef.current?.focus();
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(null);
    }
  }

  const sentId = `${CODE_ID}-envoi`;
  const canResend = resend.remaining === 0;

  return (
    <section aria-labelledby="code-titre" className="swap-in">
      <Heading as="h1" size="h3" id="code-titre" className="sm:text-[1.75rem]">
        {t.codeTitle}
      </Heading>
      <p id={sentId} className="text-ink-muted mt-3">
        {t.codeSent(challenge.channel, challenge.maskedTarget)}{' '}
        {t.codeValidity(Math.max(1, Math.round(challenge.expiresInSeconds / 60)))}
      </p>
      <form noValidate onSubmit={submit} className="mt-8 grid gap-5">
        <TextField
          id={CODE_ID}
          inputRef={codeRef}
          label={t.codeLabel}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          value={code}
          onChange={(event) => setCode(cleanCode(event.target.value))}
          aria-describedby={sentId}
          error={codeError}
          inputClassName="max-w-56 text-center text-xl tracking-[0.3em] tabular-nums"
        />
        <FormMessage>{error}</FormMessage>
        <FormMessage tone="info">{info}</FormMessage>
        <div className="grid gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={newCodeNeeded}
            aria-busy={pending === 'verify' || undefined}
          >
            {pending === 'verify' ? t.verifying : t.verify}
          </Button>
          <Button
            variant={newCodeNeeded ? 'primary' : 'secondary'}
            size="lg"
            onClick={sendAgain}
            disabled={!canResend}
            aria-busy={pending === 'resend' || undefined}
          >
            {canResend ? t.resend : t.resendIn(t.delay(resend.remaining))}
          </Button>
        </div>
        <Button variant="ghost" onClick={onChangeNumber} className="justify-self-start">
          <IconArrowLeft />
          {t.changeNumber}
        </Button>
      </form>
    </section>
  );
}
