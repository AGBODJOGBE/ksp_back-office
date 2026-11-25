'use client';

import dynamic from 'next/dynamic';
import { LoadingBlock } from '@/components/ui/loading-block';
import { cleaningTexts } from '@/features/cleaning/texts';

/*
 * Écrans du Nettoyage chargés à la demande : sans ce relais, l'index de la fonctionnalité ferait
 * télécharger tous les écrans à chaque page du module. Chaque écran n'est demandé qu'une fois la
 * session reprise, par la page qui l'affiche.
 */

const loading = () => <LoadingBlock lines={4} label={cleaningTexts.common.loading} />;

export const CatalogOverview = dynamic(() => import('./catalog-overview').then((m) => m.CatalogOverview), {
  loading,
});
export const ParametersList = dynamic(() => import('./parameters').then((m) => m.ParametersList), {
  loading,
});
export const NewParameter = dynamic(() => import('./parameters').then((m) => m.NewParameter), { loading });
export const ParameterDetail = dynamic(() => import('./parameters').then((m) => m.ParameterDetail), {
  loading,
});
export const CategoriesList = dynamic(() => import('./categories').then((m) => m.CategoriesList), {
  loading,
});
export const NewCategory = dynamic(() => import('./categories').then((m) => m.NewCategory), { loading });
export const CategoryDetail = dynamic(() => import('./categories').then((m) => m.CategoryDetail), {
  loading,
});
export const PlacesList = dynamic(() => import('./places').then((m) => m.PlacesList), { loading });
export const NewPlace = dynamic(() => import('./places').then((m) => m.NewPlace), { loading });
export const PlaceDetail = dynamic(() => import('./places').then((m) => m.PlaceDetail), { loading });
export const SkillsScreen = dynamic(() => import('./skills').then((m) => m.SkillsScreen), { loading });
export const CleaningTypesList = dynamic(() => import('./cleaning-types').then((m) => m.CleaningTypesList), {
  loading,
});
export const NewCleaningType = dynamic(() => import('./cleaning-types').then((m) => m.NewCleaningType), {
  loading,
});
export const CleaningTypeDetail = dynamic(
  () => import('./cleaning-types').then((m) => m.CleaningTypeDetail),
  {
    loading,
  },
);
export const OffersList = dynamic(() => import('./offers').then((m) => m.OffersList), { loading });
export const NewOffer = dynamic(() => import('./offers').then((m) => m.NewOffer), { loading });
export const OfferDetail = dynamic(() => import('./offers').then((m) => m.OfferDetail), { loading });
export const Simulator = dynamic(() => import('./simulator').then((m) => m.Simulator), { loading });
export const SettingsScreen = dynamic(() => import('./settings').then((m) => m.SettingsScreen), { loading });
export const ZonesScreen = dynamic(() => import('./zones').then((m) => m.ZonesScreen), { loading });
export const HolidaysScreen = dynamic(() => import('./holidays').then((m) => m.HolidaysScreen), { loading });
export const RequestsQueue = dynamic(() => import('./requests-queue').then((m) => m.RequestsQueue), {
  loading,
});
export const RequestDetail = dynamic(() => import('./request-detail').then((m) => m.RequestDetail), {
  loading,
});
export const VisitsCalendar = dynamic(() => import('./visits-calendar').then((m) => m.VisitsCalendar), {
  loading,
});
export const AgentsList = dynamic(() => import('./agents-list').then((m) => m.AgentsList), { loading });
export const AgentDetail = dynamic(() => import('./agent-detail').then((m) => m.AgentDetail), { loading });
export const AgentInvite = dynamic(() => import('./agent-invite').then((m) => m.AgentInvite), { loading });
export const TeamsList = dynamic(() => import('./teams-list').then((m) => m.TeamsList), { loading });
export const TeamDetail = dynamic(() => import('./team-detail').then((m) => m.TeamDetail), { loading });
export const NewTeam = dynamic(() => import('./team-detail').then((m) => m.NewTeam), { loading });
