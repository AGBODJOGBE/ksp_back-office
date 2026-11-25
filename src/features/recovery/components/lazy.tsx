'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { recoveryTexts } from '@/features/recovery/texts';

/*
 * Écrans du Recouvrement chargés à la demande : l'index de la fonctionnalité ne fait télécharger aucun
 * écran ; chacun n'est demandé que par la page qui l'affiche, une fois la session reprise.
 */

const loading = () => <LoadingBlock lines={4} label={recoveryTexts.common.loading} />;

export const Overview = dynamic(() => import('./overview').then((m) => m.Overview), { loading });
export const RulesList = dynamic(() => import('./rules-list').then((m) => m.RulesList), { loading });
export const RuleDetail = dynamic(() => import('./rule-detail').then((m) => m.RuleDetail), { loading });
export const NewRule = dynamic(() => import('./rule-detail').then((m) => m.NewRule), { loading });
export const PricingSimulator = dynamic(() => import('./pricing-simulator').then((m) => m.PricingSimulator), {
  loading,
});
export const SettingsScreen = dynamic(() => import('./settings-screen').then((m) => m.SettingsScreen), {
  loading,
});
export const HolidaysScreen = dynamic(() => import('./holidays').then((m) => m.HolidaysScreen), { loading });
export const CommissionInvoicesList = dynamic(
  () => import('./commission-invoices').then((m) => m.CommissionInvoicesList),
  { loading },
);
export const CommissionInvoiceDetail = dynamic(
  () => import('./commission-invoice-detail').then((m) => m.CommissionInvoiceDetail),
  { loading },
);
export const CasesList = dynamic(() => import('./cases-list').then((m) => m.CasesList), { loading });
export const CaseDetail = dynamic(() => import('./case-detail').then((m) => m.CaseDetail), { loading });
export const OfflinePayments = dynamic(() => import('./offline-payments').then((m) => m.OfflinePayments), {
  loading,
});
