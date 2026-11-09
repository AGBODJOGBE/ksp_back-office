/** Paiements en ligne (service payment, ADR-031) : liste filtrable, écarts de montant ; reversements (ADR-041). */
export { type PaymentAccess, paymentAccess } from './access';
// Écrans chargés à la demande (voir components/lazy.tsx).
export { PaymentsList, PayoutsList } from './components/lazy';
export { payoutTexts } from './payout-texts';
export { paymentPaths, paymentTexts } from './texts';
