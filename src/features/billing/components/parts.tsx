'use client';

import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { type BillingAccess, billingAccess } from '@/features/billing/access';
import { billingTexts, invoiceStatus } from '@/features/billing/texts';

/** Droits d'affichage de l'agent connecté ; `null` tant que la session n'est pas reprise. */
export function useBillingAccess(): BillingAccess | null {
  const current = useSession();
  return current ? billingAccess(current.roles) : null;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const { label, tone } = invoiceStatus(status);
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * Période facturée, du premier au dernier jour. `periodEnd` est la borne de fin, minuit (heure du
 * Bénin) du lendemain du dernier jour facturé (service billing) : on affiche le jour qui la précède.
 */
export function formatPeriod(start: string, end: string): string {
  const lastDay = new Date(new Date(end).getTime() - 1).toISOString();
  return billingTexts.invoices.period(formatDate(start), formatDate(lastDay));
}
