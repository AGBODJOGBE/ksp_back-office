'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { paymentTexts } from '@/features/payment/texts';

/* Écrans des paiements en ligne et des reversements, chargés à la demande (comme le Nettoyage). */

export const PaymentsList = dynamic(() => import('./payments-list').then((m) => m.PaymentsList), {
  loading: () => <LoadingBlock lines={4} label={paymentTexts.loading} />,
});

export const PayoutsList = dynamic(() => import('./payouts-list').then((m) => m.PayoutsList), {
  loading: () => <LoadingBlock lines={4} label={paymentTexts.loading} />,
});
