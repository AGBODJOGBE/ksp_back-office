import type * as z from 'zod/mini';
import { api, parseResponse } from '@/lib/api';
import { type Overview, overviewSchema, type WorkQueue, workQueueSchema } from './schemas';

/**
 * Appels du Recouvrement (contrat `ksp-api.v1.yaml`, routes `/api/v1/admin/recovery/*`) : socle commun
 * et tableau de bord. Chaque réponse est validée par son schéma. Tarification, réglages et factures de
 * commission : `pricing-api.ts`, `settings-api.ts`, `invoices-api.ts`.
 */
const ADMIN = '/api/v1/admin/recovery';

/** Taille de page des listes (contrat : 20 par défaut, 100 au plus). */
export const PAGE_SIZE = 20;

export const path = (...segments: string[]) => [ADMIN, ...segments.map(encodeURIComponent)].join('/');

export type Query = Record<string, string | number | boolean | undefined>;

export async function read<S extends z.ZodMiniType>(
  schema: S,
  url: string,
  query?: Query,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api.get(url, { query }));
}

export async function send<S extends z.ZodMiniType>(
  schema: S,
  method: 'post' | 'put',
  url: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<z.infer<S>> {
  const options = idempotencyKey ? { idempotencyKey } : undefined;
  return parseResponse(schema, await api[method](url, body, options));
}

/** `MoneyInput` : entier en FCFA. */
export const xof = (amount: number) => ({ amount, currency: 'XOF' as const });

/** Tableau de bord (`GET /recovery/overview`), éventuellement limité à une commune. */
export function getOverview(communeKey?: string): Promise<Overview> {
  return read(overviewSchema, path('overview'), { communeKey: communeKey || undefined });
}

/**
 * File de travail du chargé (`GET /recovery/my-day`) : rappels promis, promesses non tenues,
 * échéances manquées, relances du jour, demandes de rappel, contestations, échéanciers à valider ;
 * triée par le service. `day` (AAAA-MM-JJ) : jour demandé, aujourd'hui par défaut.
 */
export function getMyDay(day?: string): Promise<WorkQueue> {
  return read(workQueueSchema, path('my-day'), { day });
}
