/**
 * Session de l'agent pour le cadre des pages connectées : garde des pages et panneau du compte.
 * Point d'entrée séparé de l'index pour que ces pages ne chargent pas le parcours de connexion (F-012).
 */
export { AccountPanel } from './components/account-panel';
export { RequireSession } from './components/require-session';
