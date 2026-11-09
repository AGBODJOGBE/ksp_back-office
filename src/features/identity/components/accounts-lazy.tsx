'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { accountTexts } from '@/features/identity/account-admin-texts';

/*
 * Écrans de l'administration des comptes, chargés à la demande (comme les comptes entreprise) : les
 * autres pages de l'espace ne les téléchargent pas.
 */

const loading = () => <LoadingBlock lines={4} label={accountTexts.common.loading} />;

export const AccountsSearch = dynamic(() => import('./accounts-search').then((m) => m.AccountsSearch), {
  loading,
});
export const AccountDetail = dynamic(() => import('./account-detail').then((m) => m.AccountDetailView), {
  loading,
});
