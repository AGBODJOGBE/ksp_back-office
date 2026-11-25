import { cleaningPaths } from './paths';

/**
 * Sections du module que les menus de section affichent sur chaque page (étapes du catalogue,
 * réglages) : fichier léger, chargé par les coques des pages.
 */

const p = cleaningPaths.catalog;

/**
 * Ordre de construction du catalogue. Les paramètres viennent d'abord : un lieu exige son paramètre
 * « superficie » (`areaParameterId`, R-CA-14), une offre ses paramètres propres et son tarif un
 * paramètre de base. Les compétences précèdent les types qui les exigent.
 */
export const CATALOG_STEPS = [
  {
    key: 'parameters',
    href: p.parameters,
    label: 'Paramètres',
    text: 'Les questions posées au client : superficie, nombre de chambres, état des lieux… Commencez par la superficie : chaque lieu en a besoin.',
  },
  {
    key: 'categories',
    href: p.categories,
    label: 'Catégories',
    text: 'Maison, Bureaux, Salle de fête… et leurs frais de visite.',
  },
  {
    key: 'places',
    href: p.places,
    label: 'Lieux',
    text: 'Villa, appartement, studio… dans une catégorie, avec les paramètres demandés au client.',
  },
  {
    key: 'skills',
    href: p.skills,
    label: 'Compétences',
    text: 'Savoir-faire exigé des agents (vitres en hauteur, piscine…). Facultatif.',
  },
  {
    key: 'types',
    href: p.types,
    label: 'Types de nettoyage',
    text: 'Sol, vitres, vidange… ou un pack qui en regroupe plusieurs, avec la liste de contrôle des séances.',
  },
  {
    key: 'offers',
    href: p.offers,
    label: 'Offres et tarifs',
    text: 'Un type proposé pour un lieu, la taille de l’équipe, puis le tarif par tranches : brouillon, essai, publication.',
  },
  {
    key: 'simulator',
    href: p.simulator,
    label: 'Simulateur',
    text: 'Le prix qu’obtiendra le client, calculé par le serveur, avec les tarifs publiés ou un brouillon.',
  },
] as const;

export type CatalogStepKey = (typeof CATALOG_STEPS)[number]['key'];

export const CATALOG_STEPS_LABEL = 'Étapes du catalogue';
export const CATALOG_HOME_LABEL = 'Vue d’ensemble';

export const SETTINGS_SECTIONS_LABEL = 'Sections des réglages';
export const SETTINGS_SECTIONS = [
  { href: cleaningPaths.settings.general, label: 'Réglages généraux' },
  { href: cleaningPaths.settings.zones, label: 'Zones desservies' },
  { href: cleaningPaths.settings.holidays, label: 'Jours fériés' },
] as const;

export const TEAM_SECTIONS_LABEL = 'Agents ou équipes';
/** Agents (accueil de l'onglet, fiches agent comprises) et équipes. */
export const TEAM_SECTIONS = [
  { href: cleaningPaths.team, label: 'Agents', match: [cleaningPaths.agentPrefix] },
  { href: cleaningPaths.teams, label: 'Équipes' },
] as const;
