/** Indicatif proposé par défaut : Bénin. */
export const DEFAULT_COUNTRY_CODE = '+229';

/** Format international E.164 attendu par la gateway (schéma `PhoneE164`). */
const E164 = /^\+[1-9]\d{6,14}$/;
const COUNTRY_CODE = /^\+[1-9]\d{0,3}$/;

/** Retire les séparateurs usuels ; `00` en tête vaut `+`. */
function compact(value: string): string {
  const digits = value.replace(/[\s.\-()/ ]/g, '');
  return digits.startsWith('00') ? `+${digits.slice(2)}` : digits;
}

/**
 * Numéro au format E.164, ou `null` s'il ne peut pas l'être. Validation légère : la gateway reste juge
 * (elle répond `IDENTITY_PHONE_INVALID`).
 *
 * - Un numéro saisi au format international (`+…` ou `00…`) est pris tel quel, quel que soit l'indicatif.
 * - Sinon, l'indicatif est ajouté devant le numéro, sans retirer de 0 initial : au Bénin, le `01` des
 *   numéros à 10 chiffres fait partie du numéro (`+229 01 97 00 00 45`).
 */
export function toE164(countryCode: string, number: string): string | null {
  const national = compact(number);
  if (!national) return null;
  let candidate = national;
  if (!national.startsWith('+')) {
    const prefix = compact(countryCode);
    const code = prefix.startsWith('+') ? prefix : `+${prefix}`;
    if (!COUNTRY_CODE.test(code)) return null;
    candidate = `${code}${national}`;
  }
  return E164.test(candidate) ? candidate : null;
}

/** Code reçu : chiffres uniquement, 4 à 8 (6 par défaut côté identity). */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function isCodeComplete(code: string): boolean {
  return /^\d{4,8}$/.test(code);
}
