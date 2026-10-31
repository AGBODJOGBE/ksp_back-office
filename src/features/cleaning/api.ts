import { api, parseResponse } from '@/lib/api';
import {
  type Agent,
  agentListSchema,
  agentSchema,
  type Catalog,
  catalogSchema,
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
  type Zone,
  zoneListSchema,
  zoneSchema,
} from './schemas';

/**
 * Appels du navigateur à la gateway pour le Nettoyage du back-office (`/api/v1/admin/cleaning/*`,
 * 28 routes). Option A (F-005) : jeton d'accès de la session, jamais de passage par le serveur Next.
 * Seul le paiement manuel accepte une clé d'idempotence (facultative dans le contrat) : le back-office
 * l'envoie toujours.
 */

const ADMIN = '/api/v1/admin/cleaning';
const REQUESTS = `${ADMIN}/quote-requests`;
const MISSIONS = `${ADMIN}/missions`;
const INTERVENTIONS = `${ADMIN}/interventions`;

/** Taille d'une page des listes (le contrat accepte 1 à 100, 20 par défaut). */
export const PAGE_SIZE = 20;

const at = (base: string, id: string, action = '') =>
  `${base}/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

// ——— Noms des prestations (route publique du portail) ———

let serviceNames: Promise<Map<string, string>> | null = null;

/**
 * Noms des prestations proposées, lus une fois par page sur la route publique `GET /cleaning/services`
 * (les fiches ne portent que le code). Un échec n'est pas gardé : l'écran affiche alors le code.
 */
export function getServiceNames(): Promise<Map<string, string>> {
  serviceNames ??= api
    .get(`/api/v1/cleaning/services`, { auth: false })
    .then((body) => new Map(parseResponse(serviceNamesSchema, body).data.map((s) => [s.code, s.name])));
  serviceNames.catch(() => {
    serviceNames = null;
  });
  return serviceNames;
}

/** Réservé aux tests et à l'écran du catalogue (après un enregistrement). */
export function forgetServiceNames(): void {
  serviceNames = null;
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

/** Filtres de la liste, tous facultatifs et cumulables (gateway) : état, code de zone, type de client. */
export interface RequestFilters {
  status?: string;
  commune?: string;
  customerKind?: string;
}

export async function listRequests(filters: RequestFilters, cursor?: string): Promise<QuoteRequestList> {
  const { status, commune, customerKind } = filters;
  return parseResponse(
    quoteRequestListSchema,
    await api.get(REQUESTS, { query: { limit: PAGE_SIZE, cursor, status, commune, customerKind } }),
  );
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
