/**
 * Administration des comptes et des rôles (module « Administration », ADR-038). Point d'entrée séparé de
 * l'index, comme `./organizations` : les pages du module ne chargent pas le parcours de connexion.
 */
// Écrans chargés à la demande (voir components/accounts-lazy.tsx).
export { AccountDetail, AccountsSearch } from './components/accounts-lazy';
export { accountPaths, accountTexts } from './account-admin-texts';
