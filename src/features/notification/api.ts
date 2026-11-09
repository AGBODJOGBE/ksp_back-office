import { api, parseResponse } from '@/lib/api';
import {
  type Delivery,
  type DeliveryList,
  deliveryListSchema,
  deliverySchema,
  type MessageTemplate,
  templateListSchema,
} from './schemas';

/** Back-office des notifications (ADR-039) : historique des envois et modèles, en lecture seule. */
const DELIVERIES = '/api/v1/admin/notification/deliveries';
const TEMPLATES = '/api/v1/admin/notification/templates';

export const PAGE_SIZE = 25;

export const CHANNELS = ['whatsapp', 'email', 'sms', 'push', 'in_app'] as const;
export const DELIVERY_STATUSES = ['failed', 'pending', 'accepted'] as const;

/** Filtres de l'historique, tous facultatifs et cumulables (gateway). */
export interface DeliveryFilters {
  templateCode?: string;
  channel?: string;
  status?: string;
  /** Dates AAAA-MM-JJ à l'heure du Bénin, bornes incluses. */
  from?: string;
  to?: string;
  /** Compte destinataire (identifiant) : aucune recherche par numéro ni par adresse. */
  recipientUserId?: string;
}

export async function listDeliveries(filters: DeliveryFilters, cursor?: string): Promise<DeliveryList> {
  return parseResponse(
    deliveryListSchema,
    await api.get(DELIVERIES, { query: { limit: PAGE_SIZE, cursor, ...filters } }),
  );
}

export async function getDelivery(id: string): Promise<Delivery> {
  return parseResponse(deliverySchema, await api.get(`${DELIVERIES}/${encodeURIComponent(id)}`));
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  return parseResponse(templateListSchema, await api.get(TEMPLATES)).data;
}
