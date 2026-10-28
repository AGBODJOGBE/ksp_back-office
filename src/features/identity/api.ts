import { api, parseResponse, type SessionPayload } from '@/lib/api';
import {
  type Me,
  meSchema,
  type MfaChallenge,
  type MfaSession,
  mfaSessionSchema,
  type OtpChallenge,
  otpChallengeSchema,
  type TotpConfirmed,
  totpConfirmedSchema,
  type TotpEnrollment,
  totpEnrollmentSchema,
  verifyOtpResponseSchema,
  logoutSchema,
} from './schemas';

/**
 * Appels du navigateur à la gateway pour la connexion du back-office (option A, F-005 ; ADR-023).
 * La session vit dans le navigateur : ces appels ne passent jamais par le serveur Next.
 *
 * Les routes de connexion et de double authentification sont appelées sans jeton (`auth: false`) :
 * un 401 y signifie « jeton de double authentification expiré », pas « session à renouveler ».
 */

export const IDENTITY_PATHS = {
  requestOtp: '/api/v1/identity/otp/request',
  verifyOtp: '/api/v1/identity/otp/verify',
  enrollTotp: '/api/v1/identity/mfa/totp/enroll',
  confirmTotp: '/api/v1/identity/mfa/totp/confirm',
  verifyMfa: '/api/v1/identity/mfa/verify',
  logout: '/api/v1/identity/logout',
  me: '/api/v1/identity/me',
} as const;

/** Demande un code. Sans canal : la gateway choisit WhatsApp, canal par défaut du contrat (ADR-021). */
export async function requestOtp(phone: string): Promise<OtpChallenge> {
  return parseResponse(
    otpChallengeSchema,
    await api.post(IDENTITY_PATHS.requestOtp, { phone }, { auth: false }),
  );
}

export type VerifyOtpResult =
  { status: 'mfa_required'; challenge: MfaChallenge } | { status: 'authenticated'; session: SessionPayload };

/** Valide le code reçu. Un compte interne reçoit l'étape de double authentification. */
export async function verifyOtp(challengeId: string, code: string): Promise<VerifyOtpResult> {
  const body = parseResponse(
    verifyOtpResponseSchema,
    await api.post(IDENTITY_PATHS.verifyOtp, { challengeId, code }, { auth: false }),
  );
  if (body.status === 'mfa_required') return { status: 'mfa_required', challenge: body };
  const { isNewUser: _isNewUser, ...session } = body;
  return { status: 'authenticated', session };
}

/** Crée (ou remplace) le secret de l'application d'authentification, inactif jusqu'à la confirmation. */
export async function enrollTotp(mfaToken: string): Promise<TotpEnrollment> {
  return parseResponse(
    totpEnrollmentSchema,
    await api.post(IDENTITY_PATHS.enrollTotp, { mfaToken }, { auth: false }),
  );
}

/** Active la double authentification par un premier code ; la gateway pose le cookie de session. */
export async function confirmTotp(mfaToken: string, code: string): Promise<TotpConfirmed> {
  return parseResponse(
    totpConfirmedSchema,
    await api.post(IDENTITY_PATHS.confirmTotp, { mfaToken, code }, { auth: false }),
  );
}

export type MfaMethod = 'totp' | 'recovery_code';

/** Seconde étape : code de l'application, ou code de récupération (consommé). Jamais de SMS (ADR-023). */
export async function verifyMfa(mfaToken: string, method: MfaMethod, code: string): Promise<MfaSession> {
  return parseResponse(
    mfaSessionSchema,
    await api.post(IDENTITY_PATHS.verifyMfa, { mfaToken, method, code }, { auth: false }),
  );
}

/** Profil de l'agent connecté. */
export async function getMe(signal?: AbortSignal): Promise<Me> {
  return parseResponse(meSchema, await api.get(IDENTITY_PATHS.me, { signal }));
}

/** Ferme la session de ce poste ; la gateway efface le cookie de renouvellement. */
export async function logout(): Promise<void> {
  parseResponse(logoutSchema, await api.post(IDENTITY_PATHS.logout));
}

/** Retire de la réponse ce qui n'appartient pas à la session (codes de récupération, compteur). */
export function sessionOf<T extends SessionPayload>(body: T): SessionPayload {
  return {
    status: body.status,
    accessToken: body.accessToken,
    accessTokenExpiresAt: body.accessTokenExpiresAt,
    refreshTokenExpiresAt: body.refreshTokenExpiresAt,
    sessionId: body.sessionId,
    user: body.user,
    profileIncomplete: body.profileIncomplete,
  };
}
