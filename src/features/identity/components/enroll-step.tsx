'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, TextField } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { IconCheck, IconChevronDown, IconCopy } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import { confirmTotp, enrollTotp } from '@/features/identity/api';
import { useCopy } from '@/features/identity/clipboard';
import { describeError, errorText, type ErrorView } from '@/features/identity/errors';
import { groupSecret } from '@/features/identity/recovery-codes';
import type { MfaChallenge, TotpConfirmed, TotpEnrollment } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';
import { QrCode } from './qr-code';

const CODE_ID = 'configuration-code';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; enrollment: TotpEnrollment }
  | { status: 'failed'; message: string };

/**
 * Configuration forcée de l'application d'authentification (première connexion, `enrollmentRequired`) :
 * QR code et clé à saisir à la main, puis premier code pour activer. La réponse remet les codes de
 * récupération, transmis à l'étape suivante.
 */
export function EnrollStep({
  challenge,
  onConfirmed,
  onFailure,
}: {
  challenge: MfaChallenge;
  onConfirmed: (result: TotpConfirmed) => void;
  /** Étape impossible à poursuivre (jeton expiré, trop d'essais, compte refusé). */
  onFailure: (view: ErrorView) => void;
}) {
  const t = identityTexts.enroll;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  // Un seul secret par essai, même si React relance l'effet (mode strict) : un second appel le remplacerait.
  const request = useRef<{ attempt: number; promise: Promise<TotpEnrollment> } | null>(null);
  const secret = useCopy();

  // Dernière version du rappel, sans relancer l'inscription quand le parent se redessine.
  const failure = useRef(onFailure);
  useEffect(() => {
    failure.current = onFailure;
  }, [onFailure]);

  function fail(caught: unknown): ErrorView {
    const view = describeError(caught);
    if (view.restartNeeded || view.denied) failure.current(view);
    return view;
  }

  useEffect(() => {
    if (request.current?.attempt !== attempt) {
      request.current = { attempt, promise: enrollTotp(challenge.mfaToken) };
    }
    let active = true;
    request.current.promise.then(
      (enrollment) => active && setLoad({ status: 'ready', enrollment }),
      (caught: unknown) => {
        if (!active) return;
        const view = describeError(caught);
        if (view.restartNeeded || view.denied) failure.current(view);
        else setLoad({ status: 'failed', message: errorText(view) });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, challenge.mfaToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setCodeError(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError(t.codeInvalid);
      codeRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      onConfirmed(await confirmTotp(challenge.mfaToken, code));
    } catch (caught) {
      const view = fail(caught);
      if (view.field === 'mfaCode') {
        setCodeError(view.message);
        setCode('');
        codeRef.current?.focus();
      } else if (!view.restartNeeded && !view.denied) {
        setError(errorText(view));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="configuration-titre" className="swap-in">
      <Heading as="h1" size="h3" id="configuration-titre" className="sm:text-[1.75rem]">
        {t.title}
      </Heading>
      <p className="text-ink-muted mt-3">{t.intro}</p>

      {load.status === 'loading' ? (
        <div className="mt-8 grid gap-4" aria-busy="true">
          <p role="status" className="sr-only">
            {t.loading}
          </p>
          <div aria-hidden="true" className="bg-surface-sunken rounded-card mx-auto size-48 animate-pulse" />
          <div aria-hidden="true" className="bg-surface-sunken rounded-control h-12 animate-pulse" />
        </div>
      ) : null}

      {load.status === 'failed' ? (
        <div className="mt-8 grid justify-items-start gap-4">
          <FormMessage>{load.message}</FormMessage>
          <Button
            variant="secondary"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            {getDictionary().common.retry}
          </Button>
        </div>
      ) : null}

      {load.status === 'ready' ? (
        <>
          <ol className="text-ink mt-6 grid list-none gap-2 [counter-reset:etape]">
            {[t.step1, t.step2, t.step3].map((text) => (
              <li
                key={text}
                className="text-small before:bg-accent-soft before:text-accent-ink flex gap-3 [counter-increment:etape] before:grid before:size-6 before:shrink-0 before:place-items-center before:rounded-full before:text-xs before:font-semibold before:content-[counter(etape)]"
              >
                <span className="pt-0.5">{text}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid justify-items-center gap-4">
            <div className="border-line-strong rounded-card size-52 border bg-white p-2 shadow-xs">
              <QrCode
                value={load.enrollment.otpauthUri}
                label={t.qrLabel(load.enrollment.issuer, load.enrollment.accountName)}
                fallback={t.qrUnavailable}
              />
            </div>
          </div>

          <details className="group border-line bg-surface-muted rounded-control mt-6 border">
            <summary className="text-small text-ink flex min-h-11 list-none items-center justify-between gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
              {t.manualTitle}
              <IconChevronDown className="ease-soft size-4 shrink-0 duration-(--motion-base) group-open:rotate-180 motion-safe:transition-transform" />
            </summary>
            <div className="disclosure-body grid gap-3 px-4 pb-4">
              <p className="text-small text-ink-muted">
                {t.manualIntro(load.enrollment.digits, load.enrollment.periodSeconds)}
              </p>
              <dl className="text-small grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                <dt className="text-ink-muted">{t.issuer}</dt>
                <dd className="text-ink font-medium">{load.enrollment.issuer}</dd>
                <dt className="text-ink-muted">{t.account}</dt>
                <dd className="text-ink font-medium tabular-nums">{load.enrollment.accountName}</dd>
                <dt className="text-ink-muted">{t.secret}</dt>
                <dd className="text-ink font-mono font-semibold tracking-wider">
                  {groupSecret(load.enrollment.secret)}
                </dd>
              </dl>
              <Button
                variant="secondary"
                className="justify-self-start"
                onClick={() => secret.copy(load.enrollment.secret)}
              >
                {secret.state === 'copied' ? <IconCheck /> : <IconCopy />}
                {secret.state === 'copied' ? t.copied : t.copySecret}
              </Button>
              <p role="status" className="sr-only">
                {secret.state === 'copied' ? t.copied : ''}
              </p>
            </div>
          </details>

          <form noValidate onSubmit={submit} className="mt-6 grid gap-5">
            <TextField
              id={CODE_ID}
              inputRef={codeRef}
              label={t.codeLabel}
              hint={t.codeHint}
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
            <FormMessage>{error}</FormMessage>
            <Button type="submit" size="lg" aria-busy={pending || undefined}>
              {pending ? t.submitting : t.submit}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
