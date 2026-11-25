'use client';

// Module du navigateur (jeton de la session) : l'index d'identity est aussi lu par des pages serveur.
import { api, parseResponse } from '@/lib/api';
import {
  type CreateRoleInput,
  type ManagedRole,
  managedRoleSchema,
  type Permission,
  permissionListSchema,
  type UpdateRoleInput,
} from './roles-schemas';

/**
 * Rôles dynamiques du super administrateur (ADR-057, R-RB-01 à 06) : fiche, création, modification,
 * désactivation, et permissions déclarées par les services (les cases d'un rôle). identity décide de
 * tout (`super_admin` non modifiable, rôle encore attribué) et renvoie la fiche à jour. Le catalogue
 * des rôles (liste) est celui de l'attribution : `listAssignableRoles` (account-admin-api).
 */
const ROLES = '/api/v1/admin/identity/roles';
const PERMISSIONS = '/api/v1/admin/identity/permissions';

const at = (code: string, action = '') => `${ROLES}/${encodeURIComponent(code)}${action ? `/${action}` : ''}`;
const role = async (request: Promise<unknown>) => parseResponse(managedRoleSchema, await request);

export function getRole(code: string): Promise<ManagedRole> {
  return role(api.get(at(code)));
}

/** Permissions actives ; `includeRetired` ajoute celles que leur service ne déclare plus. */
export async function listPermissions(includeRetired = false): Promise<Permission[]> {
  const query = includeRetired ? '?includeRetired=true' : '';
  return parseResponse(permissionListSchema, await api.get(`${PERMISSIONS}${query}`)).data;
}

export function createRole(input: CreateRoleInput): Promise<ManagedRole> {
  return role(api.post(ROLES, input));
}

export function updateRole(code: string, input: UpdateRoleInput): Promise<ManagedRole> {
  return role(api.patch(at(code), input));
}

export function deactivateRole(code: string, reason: string): Promise<ManagedRole> {
  return role(api.post(at(code, 'deactivate'), { reason }));
}
