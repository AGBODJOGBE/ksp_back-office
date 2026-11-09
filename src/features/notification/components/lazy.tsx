'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';

/* Écrans du module Notifications, chargés à la demande (comme le Nettoyage). */

const loading = () => <LoadingBlock lines={4} label="Chargement…" />;

export const DeliveriesList = dynamic(() => import('./deliveries-list').then((m) => m.DeliveriesList), {
  loading,
});

export const DeliveryDetail = dynamic(() => import('./delivery-detail').then((m) => m.DeliveryDetail), {
  loading,
});

export const TemplatesList = dynamic(() => import('./templates-list').then((m) => m.TemplatesList), {
  loading,
});
