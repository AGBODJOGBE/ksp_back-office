'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { billingTexts } from '@/features/billing/texts';

/*
 * Écrans de la facturation, chargés à la demande (comme le Nettoyage) : chaque page ne télécharge que
 * l'écran qu'elle affiche, une fois la session reprise.
 */

const loading = () => <LoadingBlock lines={4} label={billingTexts.common.loading} />;

export const InvoicesList = dynamic(() => import('./invoices-list').then((m) => m.InvoicesList), { loading });
export const InvoiceDetail = dynamic(() => import('./invoice-detail').then((m) => m.InvoiceDetail), {
  loading,
});
export const BillingSettingsScreen = dynamic(
  () => import('./billing-settings').then((m) => m.BillingSettingsScreen),
  { loading },
);
