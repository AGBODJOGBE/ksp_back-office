/**
 * Clé d'idempotence (`Idempotency-Key`, 8 à 100 caractères `[A-Za-z0-9_-]`) : tirée une fois par
 * opération (à l'ouverture du formulaire) et renvoyée telle quelle à chaque nouvel essai, pour qu'un
 * envoi répété ne crée rien de plus. `randomUUID` n'existe que dans un contexte sécurisé : hors HTTPS
 * (poste de développement sur le réseau local), 16 octets aléatoires en hexadécimal.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
