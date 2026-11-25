/** Facturation (service billing) : factures, paiements manuels, avoirs (R-PE-07), réglages. */
export { type BillingAccess, billingAccess } from './access';
// Écrans chargés à la demande (voir components/lazy.tsx).
export { BillingSettingsScreen, CreditNotesList, InvoiceDetail, InvoicesList } from './components/lazy';
export { creditNoteTexts } from './credit-note-texts';
export { billingPaths, billingTexts } from './texts';
