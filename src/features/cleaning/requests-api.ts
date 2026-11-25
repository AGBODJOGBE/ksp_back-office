import type * as z from 'zod/mini';
import { api, parseResponse } from '@/lib/api';
import { type AmountInput, listPage, path, read, readAll, type Values } from './api';
import {
  type CleaningRequest,
  type CustomerKind,
  type LocationCorrection,
  locationCorrectionSchema,
  type Quote,
  quoteSchema,
  type RequestSort,
  type RequestStatus,
  requestSchema,
  requestSummaryListSchema,
  type SchedulePlanValue,
  type ValueReason,
  type Visit,
  visitListSchema,
  type VisitSort,
  type VisitStatus,
  visitSchema,
} from './requests-schemas';
import { type Pricing, pricingSchema } from './schemas';

/**
 * Appels du Nettoyage v2, sous-lot 1b : dossiers (demandes), visites des lieux, version retenue et
 * devis (`/api/v1/admin/cleaning/{requests,visits,quotes}`). Chaque réponse est validée par son
 * schéma. Les opérations dont le contrat exige `Idempotency-Key` reçoivent la clé tirée par l'écran à
 * l'ouverture du formulaire (`useIdempotencyKey`), renvoyée telle quelle à chaque nouvel essai.
 * Sans clé dans le contrat : version retenue (PUT), estimation, brouillon de devis (PATCH).
 */

type Method = 'post' | 'put' | 'patch';

/** Envoi avec la clé d'idempotence exigée par le contrat. */
async function send<S extends z.ZodMiniType>(
  method: Method,
  schema: S,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api[method](url, body, { idempotencyKey }));
}

// --- Dossiers ------------------------------------------------------------------------------------

/** Filtres de `GET /requests` (tous facultatifs ; `from` inclus, `to` exclu, en date-heure ISO). */
export interface RequestFilters {
  status?: RequestStatus;
  communeKey?: string;
  placeTypeId?: string;
  from?: string;
  to?: string;
  /** Numéro de dossier (50 caractères au plus). */
  q?: string;
  customerKind?: CustomerKind;
  cleaningTypeId?: string;
  customerId?: string;
  organizationId?: string;
  sort?: RequestSort;
}

/** File des dossiers, filtrée par la portée « zone » de l'appelant (R-RB-03). */
export const listRequests = (filters: RequestFilters = {}) =>
  listPage(requestSummaryListSchema, path('requests'), { ...filters });
/** Nombre de dossiers d'un statut (`total`), lu sur une page d'un élément. */
export const countRequests = async (status: RequestStatus): Promise<number> =>
  (await read(requestSummaryListSchema, path('requests'), { status, limit: 1 })).total;
export const getRequest = (id: string): Promise<CleaningRequest> => read(requestSchema, path('requests', id));

export type RejectReasonCode = 'place_inaccessible' | 'service_impossible' | 'other';
export const rejectRequest = (
  id: string,
  body: { reasonCode: RejectReasonCode; reason: string },
  key: string,
): Promise<CleaningRequest> => send('post', requestSchema, path('requests', id, 'reject'), body, key);

/** `CleaningCorrectRequestLocationBody` : `landmark` et `address` absents = inchangés. */
export interface LocationBody {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  landmark?: string;
  address?: string;
  reason: string;
}
export const correctRequestLocation = (
  id: string,
  body: LocationBody,
  key: string,
): Promise<LocationCorrection> =>
  send('put', locationCorrectionSchema, path('requests', id, 'location'), body, key);

export const decideReactivation = (
  id: string,
  body: { decision: 'accept' | 'refuse'; reason?: string },
  key: string,
): Promise<CleaningRequest> => send('post', requestSchema, path('requests', id, 'reactivation'), body, key);

export const requestNewVisit = (
  id: string,
  body: { reason: string },
  key: string,
): Promise<CleaningRequest> => send('post', requestSchema, path('requests', id, 'new-visit'), body, key);

// --- Visites -------------------------------------------------------------------------------------

export interface VisitFilters {
  from?: string;
  to?: string;
  status?: VisitStatus;
  agentId?: string;
  communeKey?: string;
  sort?: VisitSort;
}

/** `CleaningCheckOverride` : contrôle contourné avec motif (9.4). */
export interface CheckOverride {
  check: 'zone' | 'availability' | 'load' | 'team_size';
  reason: string;
}

/** `CleaningScheduleVisitBody` : `durationMinutes` absent = réglage ; `agentIds` vide avec `autoAssign`. */
export interface ScheduleVisitBody {
  requestId: string;
  scheduledAt: string;
  durationMinutes?: number;
  agentIds: string[];
  leadAgentId?: string;
  autoAssign?: boolean;
  overrides?: CheckOverride[];
}

/** `CleaningUpdateVisitBody` : champ absent = inchangé ; liste vide = vidée. */
export interface UpdateVisitBody {
  scheduledAt?: string;
  durationMinutes?: number;
  agentIds?: string[];
  leadAgentId?: string;
  overrides?: CheckOverride[];
  reason?: string;
}

export const listVisits = (filters: VisitFilters = {}) =>
  listPage(visitListSchema, path('visits'), { ...filters });
/** Toutes les visites d'une période (calendrier), page après page, 1 000 au plus. */
export const allVisits = (filters: VisitFilters): Promise<Visit[]> =>
  readAll(visitListSchema, path('visits'), { ...filters });
export const scheduleVisit = (body: ScheduleVisitBody, key: string): Promise<Visit> =>
  send('post', visitSchema, path('visits'), body, key);
export const updateVisit = (id: string, body: UpdateVisitBody, key: string): Promise<Visit> =>
  send('patch', visitSchema, path('visits', id), body, key);
export const cancelVisit = (
  id: string,
  body: { cause: 'ksp' | 'agent_no_show'; reason: string },
  key: string,
): Promise<Visit> => send('post', visitSchema, path('visits', id, 'cancel'), body, key);

/** Clôture au nom de l'agent : `values` obligatoire si aucun constat n'est enregistré. */
export interface CompleteVisitBody {
  reason: string;
  arrivedAt?: string;
  completedAt: string;
  values?: Values;
  photoFileIds?: string[];
}
export const completeVisit = (id: string, body: CompleteVisitBody, key: string): Promise<Visit> =>
  send('post', visitSchema, path('visits', id, 'complete'), body, key);
export const reportVisitMissed = (
  id: string,
  body: { reason: string; missedAt: string; photoFileId?: string },
  key: string,
): Promise<Visit> => send('post', visitSchema, path('visits', id, 'missed'), body, key);
export const removeVisitPhoto = (
  id: string,
  fileId: string,
  body: { reason: string },
  key: string,
): Promise<Visit> => send('post', visitSchema, path('visits', id, 'photos', fileId, 'remove'), body, key);

// --- Version retenue -----------------------------------------------------------------------------

/** `CleaningSaveRetainedValuesBody` : `reason` obligatoire quand un devis est envoyé. */
export interface RetainedValuesBody {
  values: Values;
  cleaningTypeIds: string[];
  reasons: ValueReason[];
  reason?: string;
}
export const saveRetainedValues = async (id: string, body: RetainedValuesBody): Promise<CleaningRequest> =>
  parseResponse(requestSchema, await api.put(path('requests', id, 'retained-values'), body));
/** Calcul sans enregistrement. */
export const estimateRetainedValues = async (
  id: string,
  body: { values: Values; cleaningTypeIds: string[] },
): Promise<Pricing> =>
  parseResponse(pricingSchema, await api.post(path('requests', id, 'retained-values', 'estimate'), body));

// --- Devis ---------------------------------------------------------------------------------------

/** `CleaningAdjustmentInput` : `percentBps` ou `fixedAmount`. */
export interface AdjustmentInput {
  kind: 'discount' | 'surcharge';
  percentBps?: number;
  fixedAmount?: AmountInput;
  reason: string;
}

/** `CleaningCreateQuoteBody` / `CleaningUpdateQuoteDraftBody` : champ absent = valeur proposée. */
export interface QuoteDraftBody {
  schedule?: SchedulePlanValue;
  teamSize?: number;
  durationMinutes?: number;
  adjustments?: AdjustmentInput[];
  onQuotePrices?: { offerId: string; price: AmountInput }[];
  validityDays?: number;
}

/** Compose un brouillon de devis, ou révise le devis envoyé (R-DV-05). */
export const createQuote = (requestId: string, body: QuoteDraftBody, key: string): Promise<Quote> =>
  send('post', quoteSchema, path('requests', requestId, 'quotes'), body, key);
export const getQuote = (id: string): Promise<Quote> => read(quoteSchema, path('quotes', id));
export const updateQuoteDraft = async (id: string, body: QuoteDraftBody): Promise<Quote> =>
  parseResponse(quoteSchema, await api.patch(path('quotes', id), body));
/** Remise au-delà du seuil : second valideur (`cleaning.quote.adjust_price`). */
export const approveQuoteAdjustment = (id: string, key: string): Promise<Quote> =>
  send('post', quoteSchema, path('quotes', id, 'approve-adjustment'), undefined, key);
export const sendQuote = (id: string, key: string): Promise<Quote> =>
  send('post', quoteSchema, path('quotes', id, 'send'), undefined, key);
