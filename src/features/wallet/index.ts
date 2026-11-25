/**
 * Portefeuilles (service wallet, ADR-042, ADR-046, ADR-048, ADR-055) : vue d'ensemble, portefeuille d'un
 * titulaire, crédit ; retraits, demandes de crédit et reversements des titulaires.
 */
export { type WalletAccess, walletAccess } from './access';
export type { HolderType } from './api';
// Écrans chargés à la demande (voir components/lazy.tsx).
export {
  CreditRequestsList,
  HolderWallet,
  WalletPayoutsList,
  WalletsOverview,
  WithdrawalsList,
} from './components/lazy';
export { creditRequestTexts, walletPayoutTexts, withdrawalTexts } from './requests-texts';
export { holderTypeOf, walletPaths, walletTexts } from './texts';
