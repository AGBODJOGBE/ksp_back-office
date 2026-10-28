import * as z from 'zod/mini';
import { sessionPayloadSchema, sessionUserSchema } from '@/lib/api';

/**
 * Réponses de la gateway pour la connexion du back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/identity/*`, ADR-023). Lecture tolérante : un champ ajouté par la gateway est ignoré.
 * Schémas lus dans le navigateur : `zod/mini`, bien plus léger que `zod`.
 */

/** `RequestOtpResponse` : code envoyé. */
export const otpChallengeSchema = z.object({
  challengeId: z.string(),
  /** Numéro masqué, par exemple `+229********45`. */
  maskedTarget: z.string(),
  /** Canal réellement utilisé, après une éventuelle bascule de WhatsApp vers le SMS. */
  channel: z.string(),
  expiresInSeconds: z.int().check(z.positive()),
  resendAfterSeconds: z.int().check(z.nonnegative()),
});

/** `MfaRequiredResponse` : étape de double authentification d'un compte interne. */
export const mfaChallengeSchema = z.object({
  status: z.literal('mfa_required'),
  /** Jeton court (5 minutes), à usage unique, présenté aux routes `/api/v1/identity/mfa/…`. */
  mfaToken: z.string().check(z.minLength(1)),
  expiresAt: z.string(),
  methods: z.array(z.string()),
  /** Première connexion : l'application d'authentification doit être configurée avant tout accès. */
  enrollmentRequired: z.boolean(),
});

/**
 * Réponse de `POST /otp/verify`. Depuis le back-office, un compte interne reçoit toujours
 * `mfa_required` ; une session directe (`VerifyOtpSessionResponse`) est lue aussi, sans être attendue.
 */
export const verifyOtpResponseSchema = z.discriminatedUnion('status', [
  z.extend(sessionPayloadSchema, { isNewUser: z.boolean() }),
  mfaChallengeSchema,
]);

/** `TotpEnrollmentResponse` : secret en attente de confirmation. */
export const totpEnrollmentSchema = z.object({
  /** Base32, pour la saisie à la main. */
  secret: z.string().check(z.regex(/^[A-Z2-7]+$/)),
  /** À afficher en QR code. */
  otpauthUri: z.string().check(z.startsWith('otpauth://totp/')),
  issuer: z.string(),
  accountName: z.string(),
  digits: z.int(),
  periodSeconds: z.int(),
});

/** `TotpConfirmedResponse` : session ouverte et 10 codes de récupération, remis une seule fois. */
export const totpConfirmedSchema = z.extend(sessionPayloadSchema, {
  recoveryCodes: z.array(z.string().check(z.regex(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/))).check(z.length(10)),
});

/** `MfaSessionResponse` : session ouverte après la double authentification. */
export const mfaSessionSchema = z.extend(sessionPayloadSchema, {
  recoveryCodesRemaining: z.int().check(z.nonnegative()),
});

/** `MeResponse` : profil de l'agent connecté. */
export const meSchema = z.object({
  user: sessionUserSchema,
  profileIncomplete: z.boolean(),
  /** Adresse en attente de confirmation par code ; `null` sinon. */
  pendingEmail: z.nullable(z.string()),
});

/** `LogoutResponse`. */
export const logoutSchema = z.object({ revokedSessions: z.int().check(z.nonnegative()) });

export type OtpChallenge = z.infer<typeof otpChallengeSchema>;
export type MfaChallenge = z.infer<typeof mfaChallengeSchema>;
export type TotpEnrollment = z.infer<typeof totpEnrollmentSchema>;
export type TotpConfirmed = z.infer<typeof totpConfirmedSchema>;
export type MfaSession = z.infer<typeof mfaSessionSchema>;
export type Me = z.infer<typeof meSchema>;
