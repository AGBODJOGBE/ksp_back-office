/**
 * Nettoyage v2 (service cleaning, ADR-054 à ADR-059) : socle du module (onglets du parcours, droits
 * d'affichage), catalogue, tarifs, simulateur et réglages (sous-lot 1a) ; file et fiche des dossiers
 * et calendrier des visites (sous-lot 1b) ; agents, candidatures, disponibilités et équipes
 * (sous-lot 1c). Planning, programmes et réclamations : pages provisoires.
 */
export { type CleaningAccess, type CleaningPermission, cleaningAccess } from './access';
export { CleaningTabs } from './components/cleaning-tabs';
export { ComingSoon } from './components/coming-soon';
export { CatalogSteps, SettingsNav, TeamNav } from './components/section-nav';
// Écrans chargés à la demande (voir components/lazy.tsx).
export {
  AgentDetail,
  AgentInvite,
  AgentsList,
  CatalogOverview,
  CategoriesList,
  CategoryDetail,
  CleaningTypeDetail,
  CleaningTypesList,
  HolidaysScreen,
  NewCategory,
  NewCleaningType,
  NewOffer,
  NewParameter,
  NewPlace,
  NewTeam,
  OfferDetail,
  OffersList,
  ParameterDetail,
  ParametersList,
  PlaceDetail,
  PlacesList,
  RequestDetail,
  RequestsQueue,
  SettingsScreen,
  Simulator,
  SkillsScreen,
  TeamDetail,
  TeamsList,
  VisitsCalendar,
  ZonesScreen,
} from './components/lazy';
export { inviteTexts } from './agent-actions-texts';
export { agentsTexts } from './agents-texts';
export { catalogTexts } from './catalog-texts';
export { cleaningPaths } from './paths';
export { requestsTexts } from './requests-texts';
export { CATALOG_STEPS } from './sections';
export { settingsTexts } from './settings-texts';
export { simulatorTexts } from './simulator-texts';
export { teamsTexts } from './teams-texts';
export { cleaningTexts } from './texts';
export { visitsTexts } from './visits-texts';
