'use client';

// Module du navigateur (jeton de la session) : l'index d'identity est aussi lu par des pages serveur.
import { api, parseResponse } from '@/lib/api';
import {
  type AccountDetail,
  accountDetailSchema,
  type AdminAccountList,
  adminAccountListSchema,
  type AssignableRole,
  assignableRoleListSchema,
} from './account-admin-schemas';

/**
 * Administration des comptes et des rôles (ADR-038) : `super_admin` partout, administrateur d'un
 * métier pour les rôles de son métier. identity décide de tout (périmètre, dernier super
 * administrateur, état du compte) et renvoie la fiche à jour après chaque action. La recherche voyage
 * dans le corps, jamais dans l'adresse (journalisée).
 */
const ACCOUNTS = '/api/v1/admin/identity/accounts';
const ROLES = '/api/v1/admin/identity/roles';

export const ACCOUNTS_PAGE_SIZE = 20;

const at = (id: string, action = '') => `${ACCOUNTS}/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;
const detail = async (request: Promise<unknown>) => parseResponse(accountDetailSchema, await request);

/** Recherche vide : comptes qui ont un rôle (l'équipe pour un administrateur de métier). */
export async function searchAccounts(query: string, cursor?: string): Promise<AdminAccountList> {
  const body = { limit: ACCOUNTS_PAGE_SIZE, ...(query ? { query } : {}), ...(cursor ? { cursor } : {}) };
  return parseResponse(adminAccountListSchema, await api.post(`${ACCOUNTS}/search`, body));
}

export function getAccount(id: string): Promise<AccountDetail> {
  return detail(api.get(at(id)));
}

export async function listAssignableRoles(): Promise<AssignableRole[]> {
  return parseResponse(assignableRoleListSchema, await api.get(ROLES)).data;
}

export function grantRole(id: string, roleCode: string, reason: string): Promise<AccountDetail> {
  return detail(api.post(at(id, 'roles'), { roleCode, reason }));
}

export function revokeRole(id: string, assignmentId: string, reason: string): Promise<AccountDetail> {
  return detail(api.post(at(id, 'roles/revoke'), { assignmentId, reason }));
}

export type AccountAction = 'suspend' | 'reactivate' | 'resetMfa';

const ACTION_PATHS: Record<AccountAction, string> = {
  suspend: 'suspend',
  reactivate: 'reactivate',
  resetMfa: 'mfa/reset',
};

/** Suspension, réactivation, réinitialisation de la double authentification (`super_admin`). */
export function changeAccount(id: string, action: AccountAction, reason: string): Promise<AccountDetail> {
  return detail(api.post(at(id, ACTION_PATHS[action]), { reason }));
}
