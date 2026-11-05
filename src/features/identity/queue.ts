// Point d'entrée `@/features/identity/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDate } from '@/lib/format';
import { toQueuePage, type WorkQueueSection } from '@/lib/work-queue';
import { listOrganizations } from './organizations-api';
import { organizationAccess, organizationPaths, organizationTexts } from './organization-texts';

const t = organizationTexts.queue;

/**
 * Comptes entreprise en attente de validation (`GET /admin/identity/organizations?status=pending_review`).
 * Lecture : `super_admin` et `support_agent` ; décision sur la fiche, par `super_admin` seul.
 */
export const organizationQueueSections: readonly WorkQueueSection[] = [
  {
    id: 'organizations-to-validate',
    title: t.title,
    description: t.description,
    roles: ['super_admin', 'support_agent'],
    seeAll: { href: `${organizationPaths.list}?etat=pending_review`, label: t.seeAll },
    load: async (roles) => {
      const label = organizationAccess(roles).decide ? t.decide : t.review;
      return toQueuePage(await listOrganizations('pending_review'), (organization) => ({
        id: organization.id,
        title: organization.legalName,
        details: [t.ifu(organization.ifu), t.requested(formatDate(organization.createdAt))],
        action: { kind: 'link', href: organizationPaths.organization(organization.id), label },
      }));
    },
  },
];
