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
export const WithdrawalsList = dynamic(() => import('./withdrawals-list').then((m) => m.WithdrawalsList), {
  loading,
});
export const CreditRequestsList = dynamic(
  () => import('./credit-requests-list').then((m) => m.CreditRequestsList),
  { loading },
);
export const WalletPayoutsList = dynamic(
  () => import('./wallet-payouts-list').then((m) => m.WalletPayoutsList),
  { loading },
);
