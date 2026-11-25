/**
 * Nettoyage v2 (service cleaning, ADR-054 à ADR-059) : socle du module (onglets du parcours, droits
 * d'affichage), catalogue, tarifs, simulateur et réglages (sous-lot 1a) ; file et fiche des dossiers
 * (sous-lot 1b). Visites, planning, programmes, agents et réclamations : pages provisoires.
 */
export { type CleaningAccess, type CleaningPermission, cleaningAccess } from './access';
export { CleaningTabs } from './components/cleaning-tabs';
export { ComingSoon } from './components/coming-soon';
export { CatalogSteps, SettingsNav } from './components/section-nav';
// Écrans chargés à la demande (voir components/lazy.tsx).
export {
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
  ZonesScreen,
} from './components/lazy';
export { catalogTexts } from './catalog-texts';
export { cleaningPaths } from './paths';
export { requestsTexts } from './requests-texts';
export { CATALOG_STEPS } from './sections';
export { settingsTexts } from './settings-texts';
export { simulatorTexts } from './simulator-texts';
export { cleaningTexts } from './texts';
