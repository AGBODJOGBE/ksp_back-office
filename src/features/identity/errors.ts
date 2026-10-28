import { ApiError } from '@/lib/api';
import { identityTexts } from './texts';

/** Champ du parcours de connexion auquel une erreur se rattache. */
export type LoginField = 'phone' | 'code' | 'mfaCode';

/** Erreur prête à afficher : message en français et conséquences pour l'écran. */
export interface ErrorView {
  message: string;
  /** Champ en cause : il reçoit le focus et porte le message. Sinon, message général annoncé. */
  field?: LoginField;
  /** Délai imposé avant une nouvelle demande (limite atteinte). */
  retryAfterSeconds?: number;
  /** Le code reçu n'est plus utilisable (expiré, trop d'essais) : il faut en demander un nouveau. */
  newCodeNeeded?: boolean;
  /** L'étape de double authentification n'est plus utilisable : il faut recommencer la connexion. */
  restartNeeded?: boolean;
  /** Le compte n'a pas accès au back-office (aucun rôle, compte suspendu) : le backend a tranché. */
  denied?: boolean;
  /** Identifiant de corrélation, affiché quand l'erreur vient du serveur (utile au support). */
  reference?: string;
}

/** Codes qui rendent le jeton de double authentification inutilisable (ADR-023). */
const RESTART_CODES = new Set([
  'IDENTITY_MFA_TOKEN_INVALID',
  'IDENTITY_MFA_TOO_MANY_ATTEMPTS',
  'IDENTITY_MFA_ENROLLMENT_REQUIRED',
  'IDENTITY_MFA_ENROLLMENT_NOT_STARTED',
  'IDENTITY_MFA_ALREADY_ENROLLED',
]);

const DENIED_CODES = new Set(['IDENTITY_BACKOFFICE_FORBIDDEN', 'IDENTITY_ACCOUNT_SUSPENDED']);

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Premier champ refusé par la validation de la gateway (`details.fields[].field`). */
function invalidField(details: Record<string, unknown>): string | undefined {
  const fields = Array.isArray(details.fields) ? (details.fields as Array<{ field?: unknown }>) : [];
  const field = fields.map((item) => item.field).find((name) => typeof name === 'string');
  return field as string | undefined;
}

function withAttempts(message: string, details: Record<string, unknown>): string {
  const remaining = positiveInteger(details.attemptsRemaining);
  return remaining ? `${message} ${identityTexts.login.attemptsRemaining(remaining)}` : message;
}

/**
 * Traduit une erreur de la gateway pour le parcours de connexion. Le message vient de la réponse
 * (`message`, déjà en français) ; le code (`IDENTITY_*`, `GATEWAY_*`) décide du traitement.
 */
export function describeError(error: unknown): ErrorView {
  const t = identityTexts.login;
  if (!(error instanceof ApiError)) return { message: t.genericError };
  const { code, message, details, status, correlationId } = error;

  if (RESTART_CODES.has(code)) return { message, restartNeeded: true };
  if (DENIED_CODES.has(code)) return { message, denied: true };

  switch (code) {
    case 'IDENTITY_OTP_INVALID':
      return { message: withAttempts(message, details), field: 'code' };
    case 'IDENTITY_MFA_CODE_INVALID':
    case 'IDENTITY_MFA_CODE_REUSED':
      return { message: withAttempts(message, details), field: 'mfaCode' };
    case 'IDENTITY_OTP_EXPIRED':
    case 'IDENTITY_OTP_TOO_MANY_ATTEMPTS':
      return { message, field: 'code', newCodeNeeded: true };
    case 'IDENTITY_PHONE_INVALID':
      return { message, field: 'phone' };
    case 'GATEWAY_VALIDATION_FAILED': {
      // Message générique de la gateway (« La requête est invalide. ») : on précise le champ en cause.
      const field = invalidField(details);
      if (field === 'phone') return { message: t.phoneInvalid, field: 'phone' };
      if (field === 'code') return { message: t.codeInvalid, field: 'code' };
      return { message };
    }
    case 'IDENTITY_OTP_RATE_LIMITED':
    case 'GATEWAY_RATE_LIMITED': {
      const retryAfterSeconds = positiveInteger(details.retryAfterSeconds);
      return retryAfterSeconds ? { message, retryAfterSeconds } : { message };
    }
    default:
      // Envoi impossible, service indisponible, délai dépassé, réseau… : message tel quel, et la
      // référence de la requête quand le serveur est en cause.
      return status >= 500 && correlationId ? { message, reference: correlationId } : { message };
  }
}

/** Message complet d'une erreur générale : message, puis référence pour le support s'il y en a une. */
export function errorText(view: ErrorView): string {
  return view.reference ? `${view.message} ${identityTexts.login.reference(view.reference)}` : view.message;
}
