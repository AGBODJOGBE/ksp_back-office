'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from './parts';

/*
 * Points d'entrée des écrans du Nettoyage, chargés à la demande (même relais que le portail). Next
 * embarque dans une page tous les composants client atteints par ses imports : sans ce relais, l'index
 * de la fonctionnalité ferait télécharger les neuf écrans à chaque page du module. Chaque écran n'est
 * demandé qu'une fois la session reprise, par la page qui l'affiche.
 */

const loading = () => <LoadingBlock lines={4} />;

export const RequestsList = dynamic(() => import('./requests-list').then((m) => m.RequestsList), { loading });
export const RequestDetail = dynamic(() => import('./request-detail').then((m) => m.RequestDetail), {
  loading,
});
export const MissionsList = dynamic(() => import('./missions-list').then((m) => m.MissionsList), { loading });
export const MissionDetail = dynamic(() => import('./mission-detail').then((m) => m.MissionDetail), {
  loading,
});
export const InterventionScreen = dynamic(
  () => import('./intervention-screen').then((m) => m.InterventionScreen),
  { loading },
);
export const CatalogScreen = dynamic(() => import('./catalog-screen').then((m) => m.CatalogScreen), {
  loading,
});
export const ZonesScreen = dynamic(() => import('./zones-screen').then((m) => m.ZonesScreen), { loading });
export const TeamScreen = dynamic(() => import('./team-screen').then((m) => m.TeamScreen), { loading });
