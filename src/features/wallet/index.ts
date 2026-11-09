/** Portefeuilles (service wallet, ADR-042 et ADR-046) : vue d'ensemble, portefeuille d'un titulaire, crédit. */
export { type WalletAccess, walletAccess } from './access';
export type { HolderType } from './api';
// Écrans chargés à la demande (voir components/lazy.tsx).
export { HolderWallet, WalletsOverview } from './components/lazy';
export { holderTypeOf, walletPaths, walletTexts } from './texts';
