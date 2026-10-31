/** Connexion du back-office (téléphone, code, double authentification). La session de l'agent : `./session`. */
export { LoginFlow } from './components/login-flow';
export { identityTexts } from './texts';
/** Recherche d'un compte par son numéro (back-office, ADR-029), pour les autres fonctionnalités. */
export { type AccountMatch, accountLookupError, accountName, findAccountByPhone } from './account-lookup';
export { DEFAULT_COUNTRY_CODE, toE164 } from './phone';
