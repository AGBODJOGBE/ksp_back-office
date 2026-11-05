'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { dashboardTexts } from '@/features/dashboard/texts';

/*
 * File « À traiter », chargée à la demande (comme les écrans des modules) : la page `/` ne télécharge pas
 * les lectures des quatre services avant la reprise de la session.
 */
export const DayQueue = dynamic(() => import('./day-queue').then((m) => m.DayQueue), {
  loading: () => <LoadingBlock lines={4} label={dashboardTexts.loading} />,
});
