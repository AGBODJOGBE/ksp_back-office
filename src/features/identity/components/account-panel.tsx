'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/field';
import { IconLogout } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import { ApiError, session, type SessionUser, useSession } from '@/lib/api';
import { getMe, logout } from '@/features/identity/api';
import { describeError, errorText } from '@/features/identity/errors';
import { LOGIN_PATH } from '@/features/identity/return-path';
import type { Me } from '@/features/identity/schemas';
import { identityTexts } from '@/features/identity/texts';

type Profile = { status: 'loading' } | { status: 'ready'; me: Me } | { status: 'failed'; message: string };

const TIME_ZONE = 'Africa/Porto-Novo';

function dayOf(date: Date): string {
  return new Intl.DateTimeFormat('fr-BJ', { dateStyle: 'short', timeZone: TIME_ZONE }).format(date);
}

/** Heure de fin de session, heure du Bénin ; le jour est ajouté s'il n'est pas aujourd'hui. */
export function formatSessionEnd(iso: string, now = new Date()): string | null {
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const sameDay = dayOf(end) === dayOf(now);
  return new Intl.DateTimeFormat('fr-BJ', {
    ...(sameDay ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(end);
}

function fullName(user: SessionUser): string | null {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

function initials(name: string | null): string {
  if (!name) return 'K';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * Compte de l'agent, au pied du menu : nom, téléphone et e-mail (`GET /me`), fin de la session
 * (12 h au plus, ADR-023) et déconnexion (`POST /logout`, la gateway efface le cookie).
 */
export function AccountPanel() {
  const t = identityTexts.account;
  const { replace } = useRouter();
  const current = useSession();
  const sessionId = current?.sessionId;
  const [profile, setProfile] = useState<Profile>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    getMe(controller.signal).then(
      (me) => setProfile({ status: 'ready', me }),
      (caught: unknown) => {
        if (controller.signal.aborted) return;
        setProfile({ status: 'failed', message: describeError(caught).message });
      },
    );
    return () => controller.abort();
  }, [sessionId, attempt]);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await logout();
    } catch (caught) {
      // 401 : la session était déjà close côté gateway ; sinon on la garde pour réessayer.
      if (!(caught instanceof ApiError && caught.status === 401)) {
        setError(errorText(describeError(caught)));
        setPending(false);
        return;
      }
    }
    session.clear('logout');
    replace(LOGIN_PATH);
  }

  if (!current) return null;

  const user = profile.status === 'ready' ? profile.me.user : current.user;
  const name = fullName(user);
  const until = formatSessionEnd(current.refreshTokenExpiresAt);

  return (
    <section aria-label={t.label} className="grid gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-brand text-on-brand font-display grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="text-ink truncate font-semibold">{name ?? t.unnamed}</p>
          {user.phone ? (
            <p className="text-small text-ink-muted tabular-nums">
              <span className="sr-only">{t.phone} : </span>
              {user.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="text-small text-ink-muted min-h-5">
        {profile.status === 'loading' ? (
          <span aria-hidden="true" className="bg-surface-sunken block h-3 w-40 animate-pulse rounded-full" />
        ) : null}
        {profile.status === 'ready' ? (
          <p className="truncate">
            <span className="sr-only">{t.email} : </span>
            {profile.me.pendingEmail
              ? t.emailPending(profile.me.pendingEmail)
              : profile.me.user.email && profile.me.user.emailVerified
                ? profile.me.user.email
                : t.emailMissing}
          </p>
        ) : null}
        {profile.status === 'failed' ? (
          <p className="flex flex-wrap items-center gap-x-2">
            <span>{profile.message}</span>
            <button
              type="button"
              onClick={() => {
                setProfile({ status: 'loading' });
                setAttempt((value) => value + 1);
              }}
              className="text-accent-ink min-h-11 font-semibold underline underline-offset-2"
            >
              {getDictionary().common.retry}
            </button>
          </p>
        ) : null}
      </div>

      {until ? (
        <p className="text-ink-subtle text-xs leading-relaxed">
          {t.sessionUntil(until)}. {t.idle}
        </p>
      ) : null}

      <Button variant="secondary" className="w-full" onClick={signOut} aria-busy={pending || undefined}>
        <IconLogout />
        {pending ? t.signingOut : t.signOut}
      </Button>
      <FormMessage>{error}</FormMessage>
    </section>
  );
}
