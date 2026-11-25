/**
 * Nettoyage v2 (service cleaning, ADR-054 à ADR-059) : socle du module (onglets du parcours, droits
 * d'affichage), catalogue, tarifs, simulateur et réglages (sous-lot 1a) ; file et fiche des dossiers
 * et calendrier des visites (sous-lot 1b) ; agents, candidatures, disponibilités, équipes,
 * planning, affectations, planification automatique, programmes et séances (sous-lot 1c).
 * Réclamations : file et fiche (sous-lot 1c-4).
 */
export { type CleaningAccess, type CleaningPermission, cleaningAccess } from './access';
export { CleaningTabs } from './components/cleaning-tabs';
export { LegacyMission } from './components/legacy-mission';
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
  ClaimDetail,
  ClaimsQueue,
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
  PlanningScreen,
  ProgramDetail,
  ProgramsList,
  RequestDetail,
  RequestsQueue,
  SessionDetail,
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
export { claimsTexts } from './claims-texts';
export { cleaningPaths } from './paths';
export { planningTexts } from './planning-texts';
export { programsTexts } from './programs-texts';
export { requestsTexts } from './requests-texts';
export { CATALOG_STEPS } from './sections';
export { settingsTexts } from './settings-texts';
export { simulatorTexts } from './simulator-texts';
export { teamsTexts } from './teams-texts';
export { cleaningTexts } from './texts';
export { visitsTexts } from './visits-texts';
