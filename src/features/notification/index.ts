/** Notifications (service notification, ADR-039) : historique des envois et modèles, en lecture seule. */
export { NOTIFICATION_ROLES } from './access';
// Écrans chargés à la demande (voir components/lazy.tsx).
export { DeliveriesList, DeliveryDetail, TemplatesList } from './components/lazy';
export { notificationPaths, notificationTexts } from './texts';
