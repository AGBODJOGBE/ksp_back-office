'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { session, type SessionPayload } from '@/lib/api';
import { type MfaMethod, sessionOf, type VerifyOtpResult } from '@/features/identity/api';
import type { ErrorView } from '@/features/identity/errors';
import { errorText } from '@/features/identity/errors';
import { RETURN_PARAM, safeReturnPath } from '@/features/identity/return-path';
import type { MfaChallenge, MfaSession, OtpChallenge, TotpConfirmed } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';
import { CodeStep } from './code-step';
import { EnrollStep } from './enroll-step';
import { type LoginStage, LoginSteps } from './login-steps';
import { MfaStep } from './mfa-step';
import { DeniedStep, RemainingCodesStep } from './notice-steps';
import { PhoneStep } from './phone-step';
import { RecoveryCodesStep } from './recovery-codes-step';

/**
 * Seuil d'alerte sur les codes de récupération restants (« le back-office prévient quand il en reste
 * peu », contrat). Valeur d'affichage, à valider.
 */
export const LOW_RECOVERY_CODES = 3;

type Step =
  | { name: 'checking' }
  | { name: 'phone'; phone?: string; notice?: string }
  | { name: 'code'; phone: string; challenge: OtpChallenge }
  | { name: 'enroll'; phone: string; challenge: MfaChallenge }
  | { name: 'codes'; phone: string; result: TotpConfirmed }
  | { name: 'mfa'; phone: string; challenge: MfaChallenge }
  | { name: 'remaining'; session: SessionPayload; remaining: number; usedRecoveryCode: boolean }
  | { name: 'denied'; message: string; phone?: string }
  | { name: 'done' };

const STAGES: Partial<Record<Step['name'], LoginStage>> = {
  phone: 0,
  code: 1,
  enroll: 2,
  codes: 2,
  mfa: 2,
};

/**
 * Connexion au back-office (ADR-023) : numéro, code reçu, puis double authentification —
 * configuration de l'application à la première connexion (QR code, clé, premier code, codes de
 * récupération), sinon code de l'application ou code de récupération. Ensuite, retour à la page
 * demandée (`?retour=`, chemin interne uniquement).
 *
 * Au chargement, une session encore valide (cookie de renouvellement) est reprise sans rien demander.
 */
export function LoginFlow() {
  const t = identityTexts.login;
  const { replace } = useRouter();
  const returnPath = safeReturnPath(useSearchParams().get(RETURN_PARAM));
  const [step, setStep] = useState<Step>({ name: 'checking' });
  const numberRef = useRef<HTMLInputElement>(null);
  const backToPhone = useRef(false);

  useEffect(() => {
    let active = true;
    session.restore().then((result) => {
      if (!active) return;
      if (result.status === 'authenticated') {
        setStep({ name: 'done' });
        replace(returnPath);
      } else if (result.status === 'forbidden') {
        setStep({ name: 'denied', message: result.error.message });
      } else {
        setStep({ name: 'phone' });
      }
    });
    return () => {
      active = false;
    };
  }, [replace, returnPath]);

  // Retour vers le numéro (changement, étape expirée) : le focus revient sur le champ à corriger.
  useEffect(() => {
    if (step.name === 'phone' && backToPhone.current) {
      backToPhone.current = false;
      numberRef.current?.focus();
    }
  }, [step]);

  const restart = useCallback((phone?: string, notice?: string) => {
    backToPhone.current = true;
    setStep({ name: 'phone', phone, notice });
  }, []);

  /** Session ouverte : mise en mémoire, puis la page demandée. */
  const open = useCallback(
    (opened: SessionPayload) => {
      session.set(sessionOf(opened));
      setStep({ name: 'done' });
      replace(returnPath);
    },
    [replace, returnPath],
  );

  /** Étape de double authentification impossible à poursuivre : refus, ou retour au numéro. */
  const failMfa = useCallback(
    (phone: string) => (view: ErrorView) => {
      if (view.denied) setStep({ name: 'denied', message: view.message, phone });
      else restart(phone, errorText(view));
    },
    [restart],
  );

  function verified(phone: string, result: VerifyOtpResult) {
    if (result.status === 'authenticated') return open(result.session);
    const { challenge } = result;
    setStep(
      challenge.enrollmentRequired ? { name: 'enroll', phone, challenge } : { name: 'mfa', phone, challenge },
    );
  }

  function mfaVerified(opened: MfaSession, method: MfaMethod) {
    const usedRecoveryCode = method === 'recovery_code';
    if (usedRecoveryCode || opened.recoveryCodesRemaining <= LOW_RECOVERY_CODES) {
      setStep({
        name: 'remaining',
        session: opened,
        remaining: opened.recoveryCodesRemaining,
        usedRecoveryCode,
      });
    } else {
      open(opened);
    }
  }

  const stage = STAGES[step.name];

  return (
    <>
      {stage !== undefined ? <LoginSteps stage={stage} /> : null}
      {renderStep()}
    </>
  );

  function renderStep() {
    switch (step.name) {
      case 'checking':
        return (
          <p role="status" className="text-ink-muted">
            {t.checking}
          </p>
        );
      case 'done':
        return (
          <p role="status" className="text-ink-muted">
            {t.sessionReady}
          </p>
        );
      case 'phone':
        return (
          <PhoneStep
            key={step.notice ?? 'phone'}
            initialPhone={step.phone}
            notice={step.notice}
            numberRef={numberRef}
            onSent={(phone, challenge) => setStep({ name: 'code', phone, challenge })}
          />
        );
      case 'code':
        return (
          <CodeStep
            phone={step.phone}
            challenge={step.challenge}
            onVerified={(result) => verified(step.phone, result)}
            onDenied={(message) => setStep({ name: 'denied', message, phone: step.phone })}
            onChangeNumber={() => restart(step.phone)}
          />
        );
      case 'enroll':
        return (
          <EnrollStep
            challenge={step.challenge}
            onConfirmed={(result) => setStep({ name: 'codes', phone: step.phone, result })}
            onFailure={failMfa(step.phone)}
          />
        );
      case 'codes':
        return (
          <RecoveryCodesStep
            codes={step.result.recoveryCodes}
            account={step.result.user.phone ?? step.phone}
            onDone={() => open(step.result)}
          />
        );
      case 'mfa':
        return (
          <MfaStep challenge={step.challenge} onVerified={mfaVerified} onFailure={failMfa(step.phone)} />
        );
      case 'remaining':
        return (
          <RemainingCodesStep
            remaining={step.remaining}
            usedRecoveryCode={step.usedRecoveryCode}
            onContinue={() => open(step.session)}
          />
        );
      case 'denied':
        return <DeniedStep message={step.message} onOtherNumber={() => restart()} />;
    }
  }
}
