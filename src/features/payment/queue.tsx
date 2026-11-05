// Point d'entrée `@/features/payment/queue` : lu seulement par la file « À traiter » du tableau de bord (navigateur).
import { formatDateTime, formatXof } from '@/lib/format';
import { QUEUE_LIMIT, toQueuePage, type WorkQueueSection } from '@/lib/work-queue';
import { PAYMENT_ROLES } from './access';
import { listPayments } from './api';
import { ResolveMismatchAction } from './components/resolve-mismatch';
import { paymentPaths, paymentTexts, subjectLabel } from './texts';

const t = paymentTexts.queue;

/**
 * Écarts de montant à traiter (`GET /admin/payment/payments?underReview=true`, ADR-032) : le traitement
 * se fait sur la ligne, comme dans la liste des paiements.
 */
export const paymentQueueSections: readonly WorkQueueSection[] = [
  {
    id: 'payment-mismatches',
    title: t.title,
    description: t.description,
    roles: PAYMENT_ROLES,
    seeAll: { href: paymentPaths.toReview, label: t.seeAll },
    load: async () =>
      toQueuePage(await listPayments({ underReview: true }, undefined, QUEUE_LIMIT), (payment) => ({
        id: payment.id,
        title: subjectLabel(payment.subject),
        details: [
          formatXof(payment.amount),
          payment.organizationName || payment.customerName || '',
          payment.providerReference ? paymentTexts.reference(payment.providerReference) : '',
          formatDateTime(payment.createdAt),
        ].filter(Boolean),
        action: {
          kind: 'inline',
          render: (done) => (
            <ResolveMismatchAction
              payment={payment}
              className="w-full sm:w-auto"
              onResolved={done}
              onStale={done}
            />
          ),
        },
      })),
  },
];
