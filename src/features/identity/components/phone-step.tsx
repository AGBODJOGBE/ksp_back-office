'use client';

import { type FormEvent, type RefObject, useState } from 'react';
import { IconArrowRight } from '@/components/ui/icons';
import { Button, ButtonArrow } from '@/components/ui/button';
import { fieldIds, FieldError, FormMessage, inputClasses } from '@/components/ui/field';
import { Heading } from '@/components/ui/heading';
import { requestOtp } from '@/features/identity/api';
import { useCountdown } from '@/features/identity/countdown';
import { describeError, errorText } from '@/features/identity/errors';
import { DEFAULT_COUNTRY_CODE, toE164 } from '@/features/identity/phone';
import type { OtpChallenge } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';

const PHONE_ID = 'connexion-numero';

/** Étape 1 : numéro de téléphone (indicatif +229 par défaut, tout pays accepté), puis demande du code. */
export function PhoneStep({
  initialPhone,
  notice,
  numberRef,
  onSent,
}: {
  /** Numéro déjà saisi (retour depuis une étape suivante) : on repart de l'indicatif par défaut. */
  initialPhone?: string;
  /** Message à annoncer à l'arrivée (étape précédente expirée, par exemple). */
  notice?: string;
  numberRef: RefObject<HTMLInputElement | null>;
  onSent: (phone: string, challenge: OtpChallenge) => void;
}) {
  const t = identityTexts.login;
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [number, setNumber] = useState(initialPhone ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [pending, setPending] = useState(false);
  const wait = useCountdown();
  const ids = fieldIds(PHONE_ID);
  const blocked = wait.remaining > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked) return;
    setError(null);
    setPhoneError(null);
    const phone = toE164(countryCode, number);
    if (!phone) {
      setPhoneError(t.phoneInvalid);
      numberRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      onSent(phone, await requestOtp(phone));
    } catch (caught) {
      const view = describeError(caught);
      if (view.retryAfterSeconds) wait.start(view.retryAfterSeconds);
      if (view.field === 'phone') {
        setPhoneError(view.message);
        numberRef.current?.focus();
      } else {
        setError(errorText(view));
      }
    } finally {
      setPending(false);
    }
  }

  const describedBy = [ids.hint, phoneError ? ids.error : null].filter(Boolean).join(' ');

  return (
    <section aria-labelledby="connexion-titre" className="swap-in">
      <Heading as="h1" size="h3" id="connexion-titre" className="sm:text-[1.75rem]">
        {t.title}
      </Heading>
      <p className="text-ink-muted mt-3">{t.intro}</p>
      <form noValidate onSubmit={submit} className="mt-8 grid gap-5">
        <fieldset>
          <legend className="text-ink font-semibold">{t.phoneLegend}</legend>
          <p id={ids.hint} className="text-small text-ink-muted mt-1">
            {t.phoneHint}
          </p>
          <div className="mt-2 flex gap-2">
            <div className="w-24 shrink-0">
              <label htmlFor="connexion-indicatif" className="sr-only">
                {t.countryCode}
              </label>
              <input
                id="connexion-indicatif"
                type="tel"
                inputMode="tel"
                autoComplete="tel-country-code"
                maxLength={6}
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={describedBy}
                className={inputClasses({ invalid: !!phoneError, className: 'text-center tabular-nums' })}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor={PHONE_ID} className="sr-only">
                {t.phoneNumber}
              </label>
              <input
                id={PHONE_ID}
                ref={numberRef}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={20}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={describedBy}
                className={inputClasses({ invalid: !!phoneError, className: 'tabular-nums' })}
              />
            </div>
          </div>
          {phoneError ? <FieldError id={ids.error}>{phoneError}</FieldError> : null}
        </fieldset>
        <FormMessage>{error}</FormMessage>
        {/* Hors de la zone d'alerte : le décompte change chaque seconde et ne doit pas être relu. */}
        {blocked ? (
          <p className="text-small text-ink-muted -mt-2">{t.retryIn(t.delay(wait.remaining))}</p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={blocked}
          aria-busy={pending || undefined}
        >
          {pending ? t.sending : t.sendCode}
          <ButtonArrow>
            <IconArrowRight />
          </ButtonArrow>
        </Button>
      </form>
    </section>
  );
}
