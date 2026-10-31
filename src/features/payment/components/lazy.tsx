'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { paymentTexts } from '@/features/payment/texts';

/* Écran des paiements en ligne, chargé à la demande (comme le Nettoyage). */

export const PaymentsList = dynamic(() => import('./payments-list').then((m) => m.PaymentsList), {
  loading: () => <LoadingBlock lines={4} label={paymentTexts.loading} />,
});
