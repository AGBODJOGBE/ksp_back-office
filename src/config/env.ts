import * as z from 'zod/mini';

/**
 * Variables d'environnement validées une seule fois. Une valeur invalide arrête le démarrage
 * avec un message clair, plutôt qu'une erreur obscure en production.
 *
 * Les variables NEXT_PUBLIC_* sont lues une par une : Next.js ne remplace que les accès explicites.
 *
 * `zod/mini` plutôt que `zod` (comme le portail) : ce module est aussi chargé par le navigateur (client
 * de la gateway), et la version complète de zod y pèserait environ 90 Ko compressés. Messages d'erreur
 * explicites : zod/mini n'embarque pas de traductions.
 */
const url = () => z.url({ error: 'Adresse complète attendue, par exemple https://admin.ksp.bj.' });

const publicSchema = z.object({
  siteUrl: url(),
  apiUrl: url(),
  portailUrl: url(),
  shopUrl: url(),
  printUrl: url(),
});

const emptyToUndefined = (value: string | undefined) => (value === '' ? undefined : value);

export const publicEnv = publicSchema.parse({
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3040',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  portailUrl: process.env.NEXT_PUBLIC_PORTAIL_URL ?? 'http://localhost:3010',
  shopUrl: process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3020',
  printUrl: process.env.NEXT_PUBLIC_PRINT_URL ?? 'http://localhost:3030',
});

export type PublicEnv = z.infer<typeof publicSchema>;

/** Adresse de la gateway pour les appels faits par le serveur Next.js. Jamais exposée au navigateur. */
export function serverApiUrl(): string {
  if (typeof window !== 'undefined') {
    throw new Error('serverApiUrl() est réservé au serveur.');
  }
  return emptyToUndefined(process.env.API_INTERNAL_URL) ?? publicEnv.apiUrl;
}
