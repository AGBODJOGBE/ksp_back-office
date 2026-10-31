'use client';

// Module du navigateur (jeton de la session) : l'index d'identity est aussi lu par des pages serveur.
import { api, parseResponse } from '@/lib/api';
import {
  type AdminOrganization,
  type AdminOrganizationDetail,
  adminOrganizationDetailSchema,
  type AdminOrganizationList,
  adminOrganizationListSchema,
  adminOrganizationSchema,
} from './organization-schemas';

/**
 * Comptes entreprise du back-office (ADR-027) : consultation par `super_admin` et `support_agent`,
 * décisions par `super_admin` seul, revérifiées par identity. Aucune clé d'idempotence dans le
 * contrat : les transitions sont conditionnelles côté identity (une seule décision gagne).
 */
const ORGANIZATIONS = '/api/v1/admin/identity/organizations';

export const PAGE_SIZE = 20;

/** États filtrables (`OrganizationStatus`), demandes à traiter d'abord. */
export const ORGANIZATION_STATUSES = ['pending_review', 'active', 'suspended', 'rejected'] as const;

const at = (id: string, action = '') =>
  `${ORGANIZATIONS}/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

export async function listOrganizations(status?: string, cursor?: string): Promise<AdminOrganizationList> {
  return parseResponse(
    adminOrganizationListSchema,
    await api.get(ORGANIZATIONS, { query: { limit: PAGE_SIZE, cursor, status } }),
  );
}

export async function getOrganization(id: string): Promise<AdminOrganizationDetail> {
  return parseResponse(adminOrganizationDetailSchema, await api.get(at(id)));
}

export type OrganizationDecision = 'validate' | 'reject' | 'suspend' | 'reactivate';

/** Décision du back-office ; `reason` obligatoire pour un refus ou une suspension. */
export async function decideOrganization(
  id: string,
  decision: OrganizationDecision,
  reason?: string,
): Promise<AdminOrganization> {
  const body = decision === 'reject' || decision === 'suspend' ? { reason } : undefined;
  return parseResponse(adminOrganizationSchema, await api.post(at(id, decision), body));
}
