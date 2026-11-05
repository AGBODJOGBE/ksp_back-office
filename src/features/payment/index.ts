/** Paiements en ligne (service payment, ADR-031) : liste filtrable, écarts de montant à traiter. */
export { type PaymentAccess, paymentAccess } from './access';
// Écran chargé à la demande (voir components/lazy.tsx).
export { PaymentsList } from './components/lazy';
export { paymentPaths, paymentTexts } from './texts';
