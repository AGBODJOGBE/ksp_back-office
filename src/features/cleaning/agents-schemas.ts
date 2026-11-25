import * as z from 'zod/mini';
import { photoSchema, WEEKDAYS } from './requests-schemas';
import { page } from './schemas';

/*
 * Agents, disponibilités et équipes du Nettoyage v2 (sous-lot 1c), champ par champ d'après le contrat
 * `ksp-api.v1.yaml` (schémas `CleaningAgent*`, `CleaningAvailability*`, `CleaningTeam*`). Mêmes règles
 * que `schemas.ts` : champ obligatoire absent = réponse invalide, champ ajouté ignoré.
 */

/** Statuts d'un agent (partie 15.2). */
export const AGENT_STATUSES = [
  'applicant',
  'under_review',
  'active',
  'suspended',
  'deactivated',
  'rejected',
] as const;
export const AGENT_SORTS = ['lastName', '-createdAt', '-ratingAverage'] as const;
export const EMPLOYMENT_KINDS = ['employee', 'independent'] as const;
export const UNAVAILABILITY_KINDS = ['leave', 'sickness', 'other'] as const;

/** `CleaningAgentSkill` : une compétence déclarée mais non validée ne compte pas (R-AG-01). */
export const agentSkillSchema = z.object({ code: z.string(), name: z.string(), validated: z.boolean() });

/** `CleaningEmergencyContact` : personne à prévenir. */
export const emergencyContactSchema = z.object({ name: z.string(), phone: z.string() });

/** `CleaningAgentStats` : activité, sans montants (R-AG-04). */
export const agentStatsSchema = z.object({
  sessionsCompleted: z.int(),
  visitsCompleted: z.int(),
  hoursThisWeek: z.number(),
  hoursThisMonth: z.number(),
  ratingAverage: z.nullable(z.number()),
  ratingsCount: z.int(),
  openClaims: z.int(),
});

/** `CleaningAgent` : agent de nettoyage (partie 9.1). */
export const agentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.enum(AGENT_STATUSES),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  /** Lien temporaire. */
  photoUrl: z.nullable(z.string()),
  employmentKind: z.enum(EMPLOYMENT_KINDS),
  residenceCommuneKey: z.string(),
  /** Communes de travail. */
  zoneKeys: z.array(z.string()),
  skills: z.array(agentSkillSchema),
  maxHoursPerDay: z.int(),
  maxHoursPerWeek: z.int(),
  emergencyContact: emergencyContactSchema,
  mobileMoneyNumber: z.nullable(z.string()),
  /** Pièce d'identité déposée (lisible de l'admin seulement). */
  hasIdDocument: z.boolean(),
  stats: agentStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const agentListSchema = page(agentSchema);

/**
 * `CleaningAgent`, réduit aux champs utiles au choix d'un agent (visite, équipe) : les autres champs du
 * contrat sont ignorés à la lecture.
 */
export const agentOptionSchema = z.object({
  id: z.string(),
  status: z.enum(AGENT_STATUSES),
  firstName: z.string(),
  lastName: z.string(),
  zoneKeys: z.array(z.string()),
});
export const agentOptionListSchema = page(agentOptionSchema);

/** `CleaningIdDocument` : recto et verso, liens temporaires (consultation tracée). */
export const idDocumentSchema = z.object({ front: photoSchema, back: photoSchema });

/** `CleaningAgentInvitation` : lien d'inscription envoyé par SMS (R-AG-02). */
export const invitationSchema = z.object({ id: z.string(), phone: z.string(), expiresAt: z.string() });

/** `CleaningTimeRange` : plage d'une journée, heure de Porto-Novo (`HH:MM`). */
export const timeRangeSchema = z.object({ start: z.string(), end: z.string() });

/** `CleaningAvailabilityRule` : plages d'un jour de la semaine (R-DS-01). */
export const availabilityRuleSchema = z.object({
  weekday: z.enum(WEEKDAYS),
  ranges: z.array(timeRangeSchema),
});

/** `CleaningExtraAvailability` : disponibilité exceptionnelle (R-DS-02). */
export const extraAvailabilitySchema = z.object({ id: z.string(), start: z.string(), end: z.string() });

/** `CleaningUnavailability` : indisponibilité (R-DS-02), forcée ou non (R-DS-04). */
export const unavailabilitySchema = z.object({
  id: z.string(),
  start: z.string(),
  end: z.string(),
  kind: z.enum(UNAVAILABILITY_KINDS),
  note: z.nullable(z.string()),
  forced: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  createdByName: z.nullable(z.string()),
});

/** `CleaningAvailability` : disponibilités d'un agent (partie 9.2). */
export const availabilitySchema = z.object({
  weekly: z.array(availabilityRuleSchema),
  extraAvailabilities: z.array(extraAvailabilitySchema),
  /** À venir et en cours. */
  unavailabilities: z.array(unavailabilitySchema),
  maxHoursPerDay: z.int(),
  maxHoursPerWeek: z.int(),
});

/** `CleaningTeamMember`. */
export const teamMemberSchema = z.object({
  agentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  status: z.enum(AGENT_STATUSES),
});

/** `CleaningTeam` : équipe (partie 9.3), jamais supprimée (désactivation). */
export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  leadAgentId: z.string(),
  members: z.array(teamMemberSchema),
  active: z.boolean(),
  createdAt: z.string(),
});
export const teamListSchema = page(teamSchema);

export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentSort = (typeof AGENT_SORTS)[number];
export type EmploymentKind = (typeof EMPLOYMENT_KINDS)[number];
export type UnavailabilityKind = (typeof UNAVAILABILITY_KINDS)[number];
export type AgentSkill = z.infer<typeof agentSkillSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type AgentOption = z.infer<typeof agentOptionSchema>;
export type IdDocument = z.infer<typeof idDocumentSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;
export type ExtraAvailability = z.infer<typeof extraAvailabilitySchema>;
export type Unavailability = z.infer<typeof unavailabilitySchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Team = z.infer<typeof teamSchema>;
