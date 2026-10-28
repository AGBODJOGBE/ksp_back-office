import * as z from 'zod/mini';

/**
 * Session renvoyée par la gateway (contrat `ksp-api.v1.yaml`, schémas `User` et `SessionResponse`), à
 * l'ouverture (après la double authentification) comme au renouvellement. Lecture tolérante : un champ
 * ajouté par la gateway est ignoré. Le jeton de renouvellement n'y figure jamais côté navigateur : il
 * voyage dans le cookie `__Secure-ksp_admin_rt` posé par la gateway.
 *
 * Schémas lus dans le navigateur : `zod/mini`, bien plus léger que `zod`.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  status: z.string(),
  firstName: z.nullable(z.string()),
  lastName: z.nullable(z.string()),
  phone: z.nullable(z.string()),
  email: z.nullable(z.string()),
  emailVerified: z.boolean(),
  preferredLanguage: z.string(),
  createdAt: z.string(),
});

export const sessionPayloadSchema = z.object({
  status: z.literal('authenticated'),
  accessToken: z.string().check(z.minLength(1)),
  /** Date ISO 8601 d'expiration du jeton d'accès (15 minutes). */
  accessTokenExpiresAt: z.string(),
  /** Fin de la session du back-office : 12 heures au plus après la double authentification (ADR-023). */
  refreshTokenExpiresAt: z.string(),
  sessionId: z.string(),
  user: sessionUserSchema,
  profileIncomplete: z.boolean(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
/** Session telle que la gateway la renvoie. */
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
