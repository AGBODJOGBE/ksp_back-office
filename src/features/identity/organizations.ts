/**
 * Comptes entreprise du back-office (ADR-027). Point d'entrée séparé de l'index, comme `./session` : les
 * pages du module « Clients et comptes » ne chargent pas le parcours de connexion, et `/connexion` ne
 * charge pas ces écrans (F-012).
 */
// Écrans chargés à la demande (voir components/organizations-lazy.tsx).
export { OrganizationDetail, OrganizationsList } from './components/organizations-lazy';
export { organizationAccess, organizationPaths, organizationTexts } from './organization-texts';
