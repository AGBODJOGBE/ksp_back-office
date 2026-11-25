/**
 * Administration des comptes et des rôles (module « Administration », ADR-043, rôles dynamiques
 * ADR-057). Point d'entrée séparé de l'index, comme `./organizations` : les pages du module ne chargent
 * pas le parcours de connexion.
 */
// Écrans chargés à la demande (voir components/accounts-lazy.tsx).
export { AccountDetail, AccountsSearch, RoleCreate, RoleDetail, RolesList } from './components/accounts-lazy';
export { accountPaths, accountTexts } from './account-admin-texts';
export { rolePaths, roleTexts } from './roles-texts';
