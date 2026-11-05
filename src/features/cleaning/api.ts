import { api, parseResponse } from '@/lib/api';
import {
  type Agent,
  agentListSchema,
  agentSchema,
  type Catalog,
  catalogSchema,
  type GroupOutcome,
  groupOutcomeSchema,
  type LocationCorrection,
  locationCorrectionSchema,
  placeTypeListSchema,
  publicPlaceTypesSchema,
  type ServiceForm,
  serviceFormsSchema,
  type Mission,
  type MissionList,
  missionListSchema,
  missionSchema,
  type QuoteRequest,
  type QuoteRequestList,
  quoteRequestListSchema,
  serviceNamesSchema,
  servedZoneListSchema,
  quoteRequestSchema,
  type ServiceDefinition,
  serviceDefinitionSchema,
  type Settings,
  settingsSchema,
  type Team,
  teamListSchema,
  teamSchema,
  type TimeSlot,
  type VisitList,
  visitListSchema,
  type Zone,
  zoneListSchema,
  zoneSchema,
} from './schemas';

/**
 * Appels du navigateur à la gateway pour le Nettoyage du back-office (`/api/v1/admin/cleaning/*`).
 * Option A (F-005) : jeton d'accès de la session, jamais de passage par le serveur Next. Le paiement
 * manuel et les opérations de groupe acceptent une clé d'idempotence (facultative dans le contrat) : le
 * back-office l'envoie toujours. Les autres écritures d'une demande n'en ont pas : l'écran désactive son
 * bouton pendant l'envoi et relit la fiche après une coupure réseau.
 */

const ADMIN = '/api/v1/admin/cleaning';
const REQUESTS = `${ADMIN}/quote-requests`;
const MISSIONS = `${ADMIN}/missions`;
const INTERVENTIONS = `${ADMIN}/interventions`;

/** Taille d'une page des listes (le contrat accepte 1 à 100, 20 par défaut). */
export const PAGE_SIZE = 20;

const at = (base: string, id: string, action = '') =>
  `${base}/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

// ——— Noms et formulaires des prestations (route publique du portail) ———

let servicesBody: Promise<unknown> | null = null;

/** Réponse de `GET /cleaning/services`, lue une fois par page ; un échec n'est pas gardé. */
function publicServices(): Promise<unknown> {
  servicesBody ??= api.get(`/api/v1/cleaning/services`, { auth: false });
  servicesBody.catch(() => {
    servicesBody = null;
  });
  return servicesBody;
}

/**
 * Noms des prestations proposées, lus sur la route publique `GET /cleaning/services` (les fiches ne
 * portent que le code). Un échec n'est pas gardé : l'écran affiche alors le code.
 */
export async function getServiceNames(): Promise<Map<string, string>> {
  const body = await publicServices();
  return new Map(parseResponse(serviceNamesSchema, body).data.map((s) => [s.code, s.name]));
}

/**
 * Formulaires publics des prestations, par code (même lecture que les noms) : libellés des réponses d'une
 * demande. Une réponse sans formulaire lisible donne une table vide : les réponses s'affichent avec leurs codes.
 */
export async function getServiceForms(): Promise<Map<string, ServiceForm>> {
  const parsed = serviceFormsSchema.safeParse(await publicServices());
  return new Map(parsed.success ? parsed.data.data.map((s) => [s.code, s.form]) : []);
}

/** Réservé aux tests et à l'écran du catalogue (après un enregistrement). */
export function forgetServiceNames(): void {
  servicesBody = null;
}

/** Type de lieu, pour un filtre : code (paramètre `placeType` de la liste) et libellé affiché. */
export interface PlaceTypeOption {
  code: string;
  label: string;
}

/**
 * Types de lieu du filtre des demandes. L'admin lit tous les types, désactivés compris
 * (`GET /admin/cleaning/place-types`) ; le superviseur, qui n'a pas cette route, lit les types actifs du
 * catalogue public (`GET /cleaning/catalog`).
 */
export async function listPlaceTypeOptions(administer: boolean): Promise<PlaceTypeOption[]> {
  if (administer) {
    return parseResponse(placeTypeListSchema, await api.get(`${ADMIN}/place-types`)).data;
  }
  return parseResponse(publicPlaceTypesSchema, await api.get(`/api/v1/cleaning/catalog`, { auth: false }))
    .placeTypes;
}

/** Zone desservie, pour un filtre : code (paramètre `commune` des listes) et nom affiché. */
export interface ZoneOption {
  code: string;
  commune: string;
}

/**
 * Zones proposées dans le filtre des demandes. L'admin lit toutes les zones, désactivées comprises (des
 * demandes anciennes peuvent y être) ; le superviseur, qui n'a pas cette route, lit les zones ouvertes
 * sur la route publique.
 */
export async function listZoneOptions(includeInactive: boolean): Promise<ZoneOption[]> {
  if (includeInactive) return listZones();
  return parseResponse(servedZoneListSchema, await api.get(`/api/v1/cleaning/zones`, { auth: false })).data;
}

// ——— Demandes de devis ———

/**
 * Filtres de la liste, tous facultatifs et cumulables (gateway) : état, code de zone, type de client,
 * groupe, type de lieu et prestation (ADR-034).
 */
export interface RequestFilters {
  status?: string;
  commune?: string;
  customerKind?: string;
  groupId?: string;
  placeType?: string;
  serviceCode?: string;
}

export async function listRequests(
  filters: RequestFilters,
  cursor?: string,
  limit: number = PAGE_SIZE,
): Promise<QuoteRequestList> {
  const { status, commune, customerKind, groupId, placeType, serviceCode } = filters;
  return parseResponse(
    quoteRequestListSchema,
    await api.get(REQUESTS, {
      query: { limit, cursor, status, commune, customerKind, groupId, placeType, serviceCode },
    }),
  );
}

/** Un groupe compte 10 demandes au plus (ADR-035) : une page de 10 les lit toutes. */
export const GROUP_LIMIT = 10;

/**
 * Demandes d'un groupe. Aucune route du back-office ne lit un groupe : la liste filtrée par `groupId`
 * (`?groupId=&limit=10`) en tient lieu.
 */
export async function listGroupRequests(groupId: string): Promise<QuoteRequest[]> {
  return (await listRequests({ groupId }, undefined, GROUP_LIMIT)).data;
}

export async function getRequest(id: string): Promise<QuoteRequest> {
  return parseResponse(quoteRequestSchema, await api.get(at(REQUESTS, id)));
}

export async function rejectRequest(id: string, reason: string): Promise<QuoteRequest> {
  return parseResponse(quoteRequestSchema, await api.post(at(REQUESTS, id, 'reject'), { reason }));
}

export async function scheduleVisit(id: string, input: { scheduledAt: string; agentId: string }) {
  return parseResponse(quoteRequestSchema, await api.post(at(REQUESTS, id, 'visits'), input));
}

/** Compte rendu de la visite : identifiant de la visite, pas de la demande. */
export async function completeVisit(visitId: string, report: string): Promise<QuoteRequest> {
  return parseResponse(
    quoteRequestSchema,
    await api.post(at(`${ADMIN}/visits`, visitId, 'complete'), { report }),
  );
}

/** `SendCleaningQuoteRequest` : sans lignes, la gateway reprend la grille en vigueur. */
export interface QuoteInput {
  lines?: Array<{ label: string; quantity: number; unitPrice: number }>;
  proposedSlots: TimeSlot[];
  validityDays?: number;
  recurrence?: { period: string; visitsPerPeriod: number; durationMonths: number };
  teamSize?: number;
  durationMinutes: number;
}

export async function sendQuote(id: string, input: QuoteInput): Promise<QuoteRequest> {
  return parseResponse(quoteRequestSchema, await api.post(at(REQUESTS, id, 'quote'), input));
}

/** `CorrectCleaningRequestLocationRequest` : `landmark` absent garde le repère, `commune` sert de repli. */
export interface LocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  landmark?: string;
  commune?: string;
}

/** Corrige la position d'une demande : appliquée à tout le groupe et aux missions non terminées (gateway). */
export async function correctLocation(id: string, input: LocationInput): Promise<LocationCorrection> {
  return parseResponse(locationCorrectionSchema, await api.put(at(REQUESTS, id, 'location'), input));
}

// ——— Opérations de groupe (ADR-035) ———

/*
 * `Idempotency-Key` facultative dans le contrat : le back-office l'envoie toujours, tirée à l'ouverture
 * de la boîte et renvoyée telle quelle si l'agent renvoie.
 */

const GROUPS = `${ADMIN}/quote-request-groups`;

export async function scheduleGroupVisit(
  groupId: string,
  input: { scheduledAt: string; agentId: string; excludeRequestIds: string[] },
  idempotencyKey: string,
): Promise<GroupOutcome> {
  return parseResponse(
    groupOutcomeSchema,
    await api.post(at(GROUPS, groupId, 'visits'), input, { idempotencyKey }),
  );
}

export async function completeGroupVisit(
  groupId: string,
  report: string,
  idempotencyKey: string,
): Promise<GroupOutcome> {
  return parseResponse(
    groupOutcomeSchema,
    await api.post(at(GROUPS, groupId, 'visits/complete'), { report }, { idempotencyKey }),
  );
}

export async function rejectGroup(
  groupId: string,
  reason: string,
  idempotencyKey: string,
): Promise<GroupOutcome> {
  return parseResponse(
    groupOutcomeSchema,
    await api.post(at(GROUPS, groupId, 'reject'), { reason }, { idempotencyKey }),
  );
}

/** `SendCleaningGroupQuotesRequest` : un devis par demande, mêmes créneaux ; lignes vides = préremplies. */
export interface GroupQuotesInput {
  proposedSlots: TimeSlot[];
  validityDays?: number;
  quotes: Array<
    { requestId: string } & Pick<QuoteInput, 'lines' | 'recurrence' | 'teamSize' | 'durationMinutes'>
  >;
}

export async function sendGroupQuotes(
  groupId: string,
  input: GroupQuotesInput,
  idempotencyKey: string,
): Promise<GroupOutcome> {
  return parseResponse(
    groupOutcomeSchema,
    await api.post(at(GROUPS, groupId, 'quotes'), input, { idempotencyKey }),
  );
}

// ——— Visites techniques (ADR-035) ———

/**
 * Filtres de la liste des visites (`GET /admin/cleaning/visits`), tous facultatifs : état, et visites prévues
 * à partir de `from` (incluse) ou avant `to` (exclue), en ISO 8601. Un agent ne reçoit que ses visites.
 */
export interface VisitFilters {
  status?: string;
  from?: string;
  to?: string;
  groupId?: string;
}

export async function listVisits(filters: VisitFilters, cursor?: string): Promise<VisitList> {
  const { status, from, to, groupId } = filters;
  return parseResponse(
    visitListSchema,
    await api.get(`${ADMIN}/visits`, { query: { limit: PAGE_SIZE, cursor, status, from, to, groupId } }),
  );
}

// ——— Missions ———

export async function listMissions(status: string | undefined, cursor?: string): Promise<MissionList> {
  return parseResponse(
    missionListSchema,
    await api.get(MISSIONS, { query: { limit: PAGE_SIZE, cursor, status } }),
  );
}

export async function getMission(id: string): Promise<Mission> {
  return parseResponse(missionSchema, await api.get(at(MISSIONS, id)));
}

export interface InterventionInput {
  scheduledStart: string;
  durationMinutes: number;
  agentIds?: string[];
  teamId?: string;
}

export async function scheduleIntervention(id: string, input: InterventionInput): Promise<Mission> {
  return parseResponse(missionSchema, await api.post(at(MISSIONS, id, 'interventions'), input));
}

export interface PaymentInput {
  amount: number;
  method: 'cash' | 'mobile_money_offline';
  reference?: string;
}

/**
 * Paiement manuel. `idempotencyKey` : clé tirée à l'ouverture du formulaire et gardée pendant les
 * renvois ; un second envoi avec la même clé ne crée pas de second paiement (gateway).
 */
export async function recordPayment(
  id: string,
  input: PaymentInput,
  idempotencyKey: string,
): Promise<Mission> {
  return parseResponse(
    missionSchema,
    await api.post(at(MISSIONS, id, 'payments'), input, { idempotencyKey }),
  );
}

export async function cancelMission(id: string, reason: string): Promise<Mission> {
  return parseResponse(missionSchema, await api.post(at(MISSIONS, id, 'cancel'), { reason }));
}

// ——— Passages ———

export type InterventionAction = 'start' | 'resume' | 'complete';

export async function interventionAction(id: string, action: InterventionAction): Promise<Mission> {
  return parseResponse(missionSchema, await api.post(at(INTERVENTIONS, id, action)));
}

export async function updateChecklist(id: string, doneCodes: string[]): Promise<Mission> {
  return parseResponse(missionSchema, await api.put(at(INTERVENTIONS, id, 'checklist'), { doneCodes }));
}

export async function reportIncident(id: string, note: string): Promise<Mission> {
  return parseResponse(missionSchema, await api.post(at(INTERVENTIONS, id, 'incident'), { note }));
}

// ——— Catalogue et réglages ———

export async function getCatalog(): Promise<Catalog> {
  return parseResponse(catalogSchema, await api.get(`${ADMIN}/catalog`));
}

/** `SaveCleaningServiceRequest` : prix en entiers de FCFA, `null` tant qu'ils ne sont pas fixés. */
export interface ServiceInput {
  name: string;
  description?: string;
  unit: string;
  active: boolean;
  pricing: {
    unitPrice: number | null;
    minimumPrice: number | null;
    options?: Array<{ code: string; label: string; price: number | null }>;
    communeCoefficients?: Array<{ commune: string; coefficientBp: number }>;
    defaultCoefficientBp?: number;
    teamSize?: { unitsPerAgent: number; minAgents: number; maxAgents: number };
    checklist?: Array<{ code: string; label: string }>;
  };
}

export async function saveService(code: string, input: ServiceInput): Promise<ServiceDefinition> {
  return parseResponse(
    serviceDefinitionSchema,
    await api.put(`${ADMIN}/catalog/services/${encodeURIComponent(code)}`, input),
  );
}

export type SettingsInput = Omit<Settings, 'updatedBy' | 'updatedByName' | 'updatedAt'>;

export async function updateSettings(input: SettingsInput): Promise<Settings> {
  return parseResponse(settingsSchema, await api.put(`${ADMIN}/catalog/settings`, input));
}

// ——— Zones desservies ———

export async function listZones(): Promise<Zone[]> {
  return parseResponse(zoneListSchema, await api.get(`${ADMIN}/zones`)).data;
}

/** Ajoute une zone, ou réactive la zone désactivée de même clé. */
export async function saveZone(commune: string): Promise<Zone> {
  return parseResponse(zoneSchema, await api.post(`${ADMIN}/zones`, { commune }));
}

export async function deactivateZone(code: string): Promise<Zone> {
  return parseResponse(zoneSchema, await api.post(at(`${ADMIN}/zones`, code, 'deactivate')));
}

// ——— Agents et équipes ———

export async function listAgents(): Promise<Agent[]> {
  return parseResponse(agentListSchema, await api.get(`${ADMIN}/agents`)).data;
}

export async function registerAgent(input: { agentId: string; displayName: string }): Promise<Agent> {
  return parseResponse(agentSchema, await api.post(`${ADMIN}/agents`, input));
}

export async function declareUnavailability(
  agentId: string,
  input: { start: string; end: string; reason?: string },
): Promise<Agent> {
  return parseResponse(
    agentSchema,
    await api.post(at(`${ADMIN}/agents`, agentId, 'unavailabilities'), input),
  );
}

export async function listTeams(): Promise<Team[]> {
  return parseResponse(teamListSchema, await api.get(`${ADMIN}/teams`)).data;
}

export async function createTeam(input: { name: string; memberIds: string[] }): Promise<Team> {
  return parseResponse(teamSchema, await api.post(`${ADMIN}/teams`, input));
}

export async function updateTeam(id: string, input: { name: string; memberIds: string[] }): Promise<Team> {
  return parseResponse(teamSchema, await api.put(at(`${ADMIN}/teams`, id), input));
}
