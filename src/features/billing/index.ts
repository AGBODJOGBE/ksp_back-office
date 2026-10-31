/** Facturation (service billing) : factures des contrats d'entreprise, paiements manuels, réglages. */
export { type BillingAccess, billingAccess } from './access';
// Écrans chargés à la demande (voir components/lazy.tsx).
export { BillingSettingsScreen, InvoiceDetail, InvoicesList } from './components/lazy';
export { billingPaths, billingTexts } from './texts';
