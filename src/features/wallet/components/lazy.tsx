'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { walletTexts } from '@/features/wallet/texts';

/* Écrans des portefeuilles, chargés à la demande (comme le Nettoyage). */

const loading = () => <LoadingBlock lines={4} label={walletTexts.loading} />;

export const WalletsOverview = dynamic(() => import('./wallets-overview').then((m) => m.WalletsOverview), {
  loading,
});
export const HolderWallet = dynamic(() => import('./holder-wallet').then((m) => m.HolderWallet), { loading });
