import { ApiError } from '@/lib/api';
import { describeError, errorText } from './errors';

const error = (status: number, code: string, message: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, code, message, details, 'c-1');

describe('erreurs de la connexion du back-office', () => {
  it('ajoute les essais restants au code reçu incorrect', () => {
    expect(
      describeError(error(400, 'IDENTITY_OTP_INVALID', 'Le code est incorrect.', { attemptsRemaining: 3 })),
    ).toEqual({ message: 'Le code est incorrect. Il vous reste 3 essais.', field: 'code' });
  });

  it.each(['IDENTITY_MFA_CODE_INVALID', 'IDENTITY_MFA_CODE_REUSED'])(
    'rattache un code d’application refusé à son champ (%s)',
    (code) => {
      expect(describeError(error(400, code, 'Code refusé.', { attemptsRemaining: 1 }))).toEqual({
        message: 'Code refusé. Il vous reste 1 essai.',
        field: 'mfaCode',
      });
    },
  );

  it.each(['IDENTITY_OTP_EXPIRED', 'IDENTITY_OTP_TOO_MANY_ATTEMPTS'])(
    'demande un nouveau code quand le code reçu n’est plus utilisable (%s)',
    (code) => {
      expect(describeError(error(422, code, 'Demandez-en un nouveau.'))).toEqual({
        message: 'Demandez-en un nouveau.',
        field: 'code',
        newCodeNeeded: true,
      });
    },
  );

  it.each([
    [401, 'IDENTITY_MFA_TOKEN_INVALID'],
    [422, 'IDENTITY_MFA_TOO_MANY_ATTEMPTS'],
    [422, 'IDENTITY_MFA_ENROLLMENT_REQUIRED'],
    [422, 'IDENTITY_MFA_ENROLLMENT_NOT_STARTED'],
    [422, 'IDENTITY_MFA_ALREADY_ENROLLED'],
  ])('fait recommencer la connexion quand l’étape n’est plus utilisable (%i %s)', (status, code) => {
    expect(describeError(error(status, code, 'Recommencez.'))).toEqual({
      message: 'Recommencez.',
      restartNeeded: true,
    });
  });

  it.each(['IDENTITY_BACKOFFICE_FORBIDDEN', 'IDENTITY_ACCOUNT_SUSPENDED'])(
    'marque le refus décidé par le backend (%s)',
    (code) => {
      expect(describeError(error(403, code, 'Accès refusé.'))).toEqual({
        message: 'Accès refusé.',
        denied: true,
      });
    },
  );

  it('rattache un numéro refusé au champ du numéro', () => {
    expect(
      describeError(
        error(400, 'GATEWAY_VALIDATION_FAILED', 'La requête est invalide.', {
          fields: [{ field: 'phone', reason: 'invalid_format' }],
        }),
      ),
    ).toEqual({ message: 'Numéro invalide\u00a0: vérifiez l’indicatif et le numéro.', field: 'phone' });
  });

  it('reprend le délai d’attente d’une limite atteinte', () => {
    expect(
      describeError(error(429, 'GATEWAY_RATE_LIMITED', 'Trop de tentatives.', { retryAfterSeconds: 45 })),
    ).toEqual({ message: 'Trop de tentatives.', retryAfterSeconds: 45 });
  });

  it('donne la référence de la requête pour une panne du serveur, pas pour une erreur de saisie', () => {
    const view = describeError(error(503, 'IDENTITY_UNAVAILABLE', 'Service indisponible.'));
    expect(view).toEqual({ message: 'Service indisponible.', reference: 'c-1' });
    expect(errorText(view)).toBe('Service indisponible. Référence à donner au support\u00a0: c-1');
    expect(errorText(describeError(error(400, 'IDENTITY_PHONE_INVALID', 'Numéro invalide.')))).toBe(
      'Numéro invalide.',
    );
  });

  it('signale la coupure réseau et toute erreur inconnue', () => {
    expect(describeError(ApiError.network()).message).toMatch(/Connexion impossible/);
    expect(describeError(new Error('bug')).message).toBe(
      'Une erreur est survenue. Réessayez dans quelques instants.',
    );
  });
});
