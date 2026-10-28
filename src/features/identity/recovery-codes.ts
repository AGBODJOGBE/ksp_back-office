import { identityTexts } from './texts';

/** Date et heure du Bénin, pour l'en-tête du fichier des codes. */
function beninDateTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-BJ', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Porto-Novo',
  }).format(date);
}

/** Contenu du fichier `.txt` des codes de récupération : un code par ligne, après un court en-tête. */
export function recoveryCodesFile(codes: readonly string[], account: string, issuedAt: Date): string {
  return [...identityTexts.recovery.fileHeader(account, beninDateTime(issuedAt)), ...codes, ''].join('\n');
}

/** Clé TOTP en groupes de 4 caractères, plus facile à recopier (les espaces sont ignorés à la saisie). */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}

/** Code de récupération saisi : majuscules, sans espaces ni tirets superflus (la gateway les ignore aussi). */
export function cleanRecoveryCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^0-9A-Z-]/g, '')
    .slice(0, 11);
}

/** Code de récupération complet : 10 caractères alphanumériques, tiret facultatif. */
export function isRecoveryCodeComplete(value: string): boolean {
  return /^[0-9A-Z]{10}$/.test(value.replace(/-/g, ''));
}
