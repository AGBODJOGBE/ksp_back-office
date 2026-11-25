/**
 * Recouvrement (service recovery, ADR-060 à ADR-064) : socle du module (onglets, droits d'affichage),
 * tableau de bord, tarification par paliers et simulateur, réglages, jours fériés, factures de
 * commission (sous-lot 4a) ; file et fiche des dossiers, paiements hors ligne (sous-lot 4b).
 */
export { type RecoveryAccess, recoveryAccess, RECOVERY_MODULE_ROLES } from './access';
export { RecoveryTabs } from './components/recovery-tabs';
export { PricingNav, SettingsNav } from './components/section-nav';
// Écrans chargés à la demande (voir components/lazy.tsx).
export {
  CaseDetail,
  CasesList,
  CommissionInvoiceDetail,
  CommissionInvoicesList,
  HolidaysScreen,
  NewRule,
  OfflinePayments,
  Overview,
  PricingSimulator,
  RuleDetail,
  RulesList,
  SettingsScreen,
} from './components/lazy';
export { caseListTexts } from './case-list-texts';
export { invoiceTexts } from './invoice-texts';
export { offlineTexts } from './offline-texts';
export { overviewTexts } from './overview-texts';
export { recoveryPaths } from './paths';
export { simulatorTexts } from './pricing-editor-texts';
export { pricingTexts } from './pricing-texts';
export { settingsTexts } from './settings-texts';
export { recoveryTexts } from './texts';
