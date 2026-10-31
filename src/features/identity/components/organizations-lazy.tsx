'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { organizationTexts } from '@/features/identity/organization-texts';

/*
 * Écrans des comptes entreprise, chargés à la demande (comme le Nettoyage) : l'index d'identity est lu
 * par toutes les pages de l'espace, qui ne doivent pas télécharger ces écrans.
 */

const loading = () => <LoadingBlock lines={4} label={organizationTexts.common.loading} />;

export const OrganizationsList = dynamic(
  () => import('./organizations-list').then((m) => m.OrganizationsList),
  { loading },
);
export const OrganizationDetail = dynamic(
  () => import('./organization-detail').then((m) => m.OrganizationDetail),
  { loading },
);
