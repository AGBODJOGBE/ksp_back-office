import * as z from 'zod/mini';

/*
 * Rôles dynamiques et permissions du back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/identity/roles/{code}`, `/roles/{code}/deactivate`, `/permissions` ; ADR-057,
 * R-RB-01 à 06), champ par champ. Schémas lus dans le navigateur : `zod/mini`.
 */

/** `ManagedRole` : fiche d'un rôle géré au back-office. */
export const managedRoleSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  /** Service qui l'a livré par défaut ; `identity` pour un rôle créé au back-office. */
  service: z.string(),
  origin: z.enum(['default', 'custom']),
  /** `RoleScopeType` : chaîne, un nouveau type s'affiche avec un libellé neutre. */
  scopeType: z.string(),
  permissions: z.array(z.string()),
  /** Son retrait ferme tout de suite les sessions (R-RB-05). */
  sensitive: z.boolean(),
  backofficeAccess: z.boolean(),
  requiresMfa: z.boolean(),
  active: z.boolean(),
  /** false pour `super_admin` (R-RB-04). */
  editable: z.boolean(),
  activeAssignments: z.number(),
  createdAt: z.string(),
  createdBy: z.nullable(z.string()),
  updatedAt: z.nullable(z.string()),
  updatedBy: z.nullable(z.string()),
  deactivatedAt: z.nullable(z.string()),
  deactivatedBy: z.nullable(z.string()),
});

/** `PermissionList` : permissions déclarées par les services, triées par service, module puis code. */
export const permissionListSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      description: z.string(),
      service: z.string(),
      /** Groupe de cases au back-office (deuxième segment du code). */
      module: z.string(),
      /** Plus déclarée par son service : n'entre plus dans les jetons. */
      retired: z.boolean(),
    }),
  ),
});

export type ManagedRole = z.infer<typeof managedRoleSchema>;
export type Permission = z.infer<typeof permissionListSchema>['data'][number];

/** `CreateRoleRequest`. */
export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
  sensitive?: boolean;
  reason: string;
}

/** `UpdateRoleRequest` : `permissions` remplace la liste entière ; un champ absent reste inchangé. */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
  sensitive?: boolean;
  permissions?: string[];
  reason: string;
}

/** Format d'un code de rôle (`^[a-z][a-z0-9_]{2,63}$`). */
export const ROLE_CODE = /^[a-z][a-z0-9_]{2,63}$/;
