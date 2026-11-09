import * as z from 'zod/mini';

/*
 * Administration des comptes et des rôles lue par le back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/identity/accounts*` et `/roles`, ADR-043), champ par champ. Les énumérations restent
 * des chaînes : un nouvel état ou un nouveau rôle s'affiche avec un libellé neutre. Schémas lus dans
 * le navigateur : `zod/mini`.
 */

/** `AdminAccount` : un compte vu par l'administration. */
export const adminAccountSchema = z.object({
  userId: z.string(),
  status: z.string(),
  firstName: z.nullable(z.string()),
  lastName: z.nullable(z.string()),
  /** Numéro complet pour `super_admin` ; null pour un administrateur de métier. */
  phone: z.nullable(z.string()),
  phoneMasked: z.nullable(z.string()),
  createdAt: z.string(),
  suspendedAt: z.nullable(z.string()),
  suspensionReason: z.nullable(z.string()),
  /** Codes des rôles actifs. */
  roles: z.array(z.string()),
});

export const adminAccountListSchema = z.object({
  data: z.array(adminAccountSchema),
  nextCursor: z.nullable(z.string()),
});

/** `AdminRoleAssignment` : attribution active (`revokedAt` null) ou retirée. */
export const roleAssignmentSchema = z.object({
  id: z.string(),
  roleCode: z.string(),
  roleDescription: z.string(),
  service: z.string(),
  scopeType: z.string(),
  scopeId: z.nullable(z.string()),
  grantedAt: z.string(),
  grantedBy: z.nullable(z.string()),
  grantedByName: z.nullable(z.string()),
  grantReason: z.nullable(z.string()),
  revokedAt: z.nullable(z.string()),
  revokedBy: z.nullable(z.string()),
  revokedByName: z.nullable(z.string()),
  revokeReason: z.nullable(z.string()),
  /** L'agent connecté peut retirer ce rôle (décidé par identity). */
  revocable: z.boolean(),
});

export const auditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  at: z.string(),
  actorId: z.string(),
  actorName: z.nullable(z.string()),
  roleCode: z.nullable(z.string()),
  reason: z.nullable(z.string()),
});

/** `AdminAccountDetail` : fiche renvoyée par la lecture et par chaque action. */
export const accountDetailSchema = z.object({
  account: adminAccountSchema,
  mfa: z.object({
    configured: z.boolean(),
    configuredAt: z.nullable(z.string()),
    recoveryCodesRemaining: z.number(),
  }),
  roles: z.array(roleAssignmentSchema),
  history: z.array(auditEntrySchema),
  /** Actions permises à l'agent connecté, dans l'état actuel du compte (décidées par identity). */
  actions: z.object({
    grantRole: z.boolean(),
    suspend: z.boolean(),
    reactivate: z.boolean(),
    resetMfa: z.boolean(),
  }),
});

export const assignableRoleListSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      service: z.string(),
      scopeType: z.string(),
      description: z.string(),
      backofficeAccess: z.boolean(),
      grantable: z.boolean(),
    }),
  ),
});

export type AdminAccount = z.infer<typeof adminAccountSchema>;
export type AdminAccountList = z.infer<typeof adminAccountListSchema>;
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
export type AssignableRole = z.infer<typeof assignableRoleListSchema>['data'][number];
