'use client';

// Module du navigateur (jeton de la session) : l'index d'identity est aussi lu par des pages serveur,
// qui n'en reçoivent ainsi que des références, jamais le client de la gateway.
import * as z from 'zod/mini';
import { api, ApiError, parseResponse } from '@/lib/api';

/**
 * Recherche d'un compte KSP par son numéro (ADR-029, `POST /api/v1/admin/identity/accounts/lookup`),
 * par exemple pour le rattacher comme agent du Nettoyage. Rôles `cleaning_admin` et `super_admin`,
 * revérifiés par identity. Le numéro voyage dans le corps, jamais dans l'adresse (journalisée).
 */

/** `AdminAccountMatch` : le minimum pour reconnaître le compte ; jamais l'e-mail ni le numéro complet. */
export const accountMatchSchema = z.object({
  userId: z.string(),
  status: z.string(),
  firstName: z.nullable(z.string()),
  lastName: z.nullable(z.string()),
  /** Indicatif et deux derniers chiffres, par exemple `+229********45`. */
  phoneMasked: z.string(),
});

export type AccountMatch = z.infer<typeof accountMatchSchema>;

export const ACCOUNT_LOOKUP_PATH = '/api/v1/admin/identity/accounts/lookup';

export async function findAccountByPhone(phone: string): Promise<AccountMatch> {
  return parseResponse(accountMatchSchema, await api.post(ACCOUNT_LOOKUP_PATH, { phone }));
}

/** Prénom et nom du compte, ou `null` tant que le profil n'est pas complété. */
export function accountName(match: AccountMatch): string | null {
  const name = [match.firstName, match.lastName].filter(Boolean).join(' ').trim();
  return name || null;
}

const texts = {
  notFound: 'Aucun compte KSP pour ce numéro. La personne doit d’abord se connecter une fois avec ce numéro.',
  rateLimited: (seconds?: number) =>
    seconds
      ? `Trop de recherches d’affilée. Réessayez dans ${seconds} seconde${seconds > 1 ? 's' : ''}.`
      : 'Trop de recherches d’affilée. Réessayez dans une minute.',
  phoneInvalid:
    'Numéro invalide : saisissez un numéro au format international, par exemple +229 01 97 00 00 45.',
} as const;

/**
 * Message d'un échec de la recherche : compte introuvable (404), limite d'appels atteinte (429,
 * 20 recherches par minute), numéro refusé (400). Les autres erreurs gardent le message de la gateway.
 */
export function accountLookupError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 404) return texts.notFound;
  if (error.status === 429) {
    const seconds = error.details.retryAfterSeconds;
    return texts.rateLimited(typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds) : undefined);
  }
  if (error.code === 'IDENTITY_PHONE_INVALID') return texts.phoneInvalid;
  return null;
}
