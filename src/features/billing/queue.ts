// Point d'entrée `@/features/billing/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDate, formatXof } from '@/lib/format';
import { toQueuePage, type WorkQueueSection } from '@/lib/work-queue';
import { BILLING_ROLES } from './access';
import { listInvoices } from './api';
import { billingPaths, billingTexts } from './texts';

const t = billingTexts.queue;

/**
 * Factures impayées (`GET /admin/billing/invoices?status=overdue`, `InvoiceStatus` : `overdue` après
 * l'échéance). Le paiement manuel se fait sur la fiche de la facture. Page de 20 (`PAGE_SIZE`).
 */
export const billingQueueSections: readonly WorkQueueSection[] = [
  {
    id: 'invoices-overdue',
    title: t.title,
    description: t.description,
    roles: Object.values(BILLING_ROLES),
    seeAll: { href: `${billingPaths.invoices}?etat=overdue`, label: t.seeAll },
    load: async () =>
      toQueuePage(await listInvoices({ status: 'overdue' }), (invoice) => ({
        id: invoice.id,
        title: billingTexts.invoice.title(invoice.number),
        details: [
          invoice.organization?.legalName ?? '',
          t.balance(formatXof(invoice.balance)),
          t.dueAt(formatDate(invoice.dueAt)),
        ].filter(Boolean),
        action: { kind: 'link', href: billingPaths.invoice(invoice.id), label: t.action },
      })),
  },
];
