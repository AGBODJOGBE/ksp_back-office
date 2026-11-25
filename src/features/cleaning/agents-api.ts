import type * as z from 'zod/mini';
import { api, parseResponse } from '@/lib/api';
import { listPage, path, read, readAll } from './api';
import {
  type Agent,
  agentListSchema,
  type AgentOption,
  agentOptionListSchema,
  agentSchema,
  type AgentSort,
  type AgentStatus,
  type Availability,
  type AvailabilityRule,
  availabilitySchema,
  type EmergencyContact,
  type EmploymentKind,
  type IdDocument,
  idDocumentSchema,
  type Invitation,
  invitationSchema,
  type Team,
  teamListSchema,
  teamSchema,
  type UnavailabilityKind,
} from './agents-schemas';
import type { TimeSlot } from './requests-schemas';

/**
 * Appels du Nettoyage v2, sous-lot 1c : agents et candidatures, disponibilités, équipes
 * (`/api/v1/admin/cleaning/{agents,teams}`). Chaque réponse est validée par son schéma. Les opérations
 * dont le contrat exige `Idempotency-Key` reçoivent la clé tirée par l'écran, renvoyée telle quelle à
 * chaque nouvel essai. Sans clé dans le contrat : modification d'un agent ou d'une équipe (PATCH),
 * disponibilités (PUT), retrait d'une indisponibilité (DELETE).
 */

/** Envoi avec la clé d'idempotence exigée par le contrat. */
async function keyed<S extends z.ZodMiniType>(
  schema: S,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api.post(url, body, { idempotencyKey }));
}

// --- Agents --------------------------------------------------------------------------------------

/** Filtres de `GET /agents` (tous facultatifs). */
export interface AgentFilters {
  status?: AgentStatus;
  /** Commune de travail. */
  zoneKey?: string;
  /** Compétence validée. */
  skillCode?: string;
  /** Nom ou téléphone (100 caractères au plus). */
  q?: string;
  sort?: AgentSort;
}

export const listAgents = (filters: AgentFilters = {}) =>
  listPage(agentListSchema, path('agents'), { ...filters });
/** Nombre d'agents d'un statut (`total`), lu sur une page d'un élément. */
export const countAgents = async (status: AgentStatus): Promise<number> =>
  (await read(agentListSchema, path('agents'), { status, limit: 1 })).total;
/** Agents actifs (`GET /agents?status=active`), triés par nom : choix d'un agent (visite, équipe). */
export const activeAgents = (): Promise<AgentOption[]> =>
  readAll(agentOptionListSchema, path('agents'), { status: 'active' });
export const getAgent = (id: string): Promise<Agent> => read(agentSchema, path('agents', id));

/** `CleaningCreateAgentBody` : mêmes informations que l'inscription ; l'agent naît « en vérification ». */
export interface CreateAgentBody {
  phone: string;
  firstName: string;
  lastName: string;
  photoFileId: string;
  idDocumentFrontFileId: string;
  idDocumentBackFileId: string;
  residenceCommuneKey: string;
  zoneKeys: string[];
  skillCodes: string[];
  weekly: AvailabilityRule[];
  emergencyContact: EmergencyContact;
  employmentKind: EmploymentKind;
  mobileMoneyNumber?: string;
}
export const createAgent = (body: CreateAgentBody, key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents'), body, key);

/** `CleaningUpdateAgentBody` : champ absent = inchangé ; liste vide = vidée. */
export interface UpdateAgentBody {
  zoneKeys?: string[];
  validatedSkillCodes?: string[];
  maxHoursPerDay?: number;
  maxHoursPerWeek?: number;
  employmentKind?: EmploymentKind;
  residenceCommuneKey?: string;
  emergencyContact?: EmergencyContact;
}
export const updateAgent = async (id: string, body: UpdateAgentBody): Promise<Agent> =>
  parseResponse(agentSchema, await api.patch(path('agents', id), body));

/** Pièce d'identité : liens temporaires, consultation tracée au journal d'audit. */
export const getAgentIdDocument = (id: string): Promise<IdDocument> =>
  read(idDocumentSchema, path('agents', id, 'id-document'));

/** Lien d'inscription envoyé par SMS au numéro (E.164). */
export const inviteAgent = (phone: string, key: string): Promise<Invitation> =>
  keyed(invitationSchema, path('agents', 'invitations'), { phone }, key);

// --- Cycle de vie (partie 15.2) ------------------------------------------------------------------

/** Candidat → en vérification. */
export const reviewAgent = (id: string, key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents', id, 'review'), undefined, key);
/** En vérification → actif, avec les compétences validées (une au moins). */
export const approveAgent = (id: string, validatedSkillCodes: string[], key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents', id, 'approve'), { validatedSkillCodes }, key);
export const rejectAgent = (id: string, reason: string, key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents', id, 'reject'), { reason }, key);
/** Ses affectations à venir sont retirées et replanifiées. */
export const suspendAgent = (id: string, reason: string, key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents', id, 'suspend'), { reason }, key);
export const reactivateAgent = (id: string, key: string): Promise<Agent> =>
  keyed(agentSchema, path('agents', id, 'reactivate'), undefined, key);
/** Refusée tant qu'il a des affectations à venir, sauf `reassign: true`. */
export const deactivateAgent = (
  id: string,
  body: { reassign: boolean; reason: string },
  key: string,
): Promise<Agent> => keyed(agentSchema, path('agents', id, 'deactivate'), body, key);

// --- Disponibilités (partie 9.2) -----------------------------------------------------------------

export const getAvailability = (id: string): Promise<Availability> =>
  read(availabilitySchema, path('agents', id, 'availability'));

/** `CleaningSetAgentAvailabilityBody` : modèle et exceptions complets (remplacent les précédents). */
export interface AvailabilityBody {
  weekly: AvailabilityRule[];
  extraAvailabilities: TimeSlot[];
  maxHoursPerDay?: number;
  maxHoursPerWeek?: number;
  /** Retirer une plage occupée : les affectations touchées sont retirées et replanifiées. */
  force?: boolean;
}
export const setAvailability = async (id: string, body: AvailabilityBody): Promise<Availability> =>
  parseResponse(availabilitySchema, await api.put(path('agents', id, 'availability'), body));

/** `CleaningDeclareAgentUnavailabilityBody` : `force` désaffecte l'agent des séances touchées. */
export interface UnavailabilityBody {
  start: string;
  end: string;
  kind: UnavailabilityKind;
  note?: string;
  force?: boolean;
}
export const declareUnavailability = (
  id: string,
  body: UnavailabilityBody,
  key: string,
): Promise<Availability> => keyed(availabilitySchema, path('agents', id, 'unavailabilities'), body, key);
export const removeUnavailability = async (id: string, unavailabilityId: string): Promise<Availability> =>
  parseResponse(
    availabilitySchema,
    await api.delete(path('agents', id, 'unavailabilities', unavailabilityId)),
  );

// --- Équipes (partie 9.3) ------------------------------------------------------------------------

/** Équipes actives et désactivées, triées par nom. */
export const listTeams = (filters: { active?: boolean } = {}) =>
  listPage(teamListSchema, path('teams'), {
    active: filters.active === undefined ? undefined : String(filters.active),
  });
/** Équipes actives, toutes pages lues : choix d'une équipe à affecter (planning). */
export const activeTeams = (): Promise<Team[]> => readAll(teamListSchema, path('teams'), { active: 'true' });
export const getTeam = (id: string): Promise<Team> => read(teamSchema, path('teams', id));

/** `CleaningCreateTeamBody` : le chef d'équipe est membre de l'équipe. */
export interface CreateTeamBody {
  name: string;
  leadAgentId: string;
  memberIds: string[];
}
export const createTeam = (body: CreateTeamBody, key: string): Promise<Team> =>
  keyed(teamSchema, path('teams'), body, key);

/** `CleaningUpdateTeamBody` : champ absent = inchangé ; `active: false` désactive sans supprimer. */
export type UpdateTeamBody = Partial<CreateTeamBody> & { active?: boolean };
export const updateTeam = async (id: string, body: UpdateTeamBody): Promise<Team> =>
  parseResponse(teamSchema, await api.patch(path('teams', id), body));
