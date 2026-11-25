/** Adresses des écrans du Nettoyage v2 dans le back-office. */

const id = (value: string) => encodeURIComponent(value);
const CATALOG = '/nettoyage/catalogue';
const SETTINGS = '/nettoyage/reglages';

export const cleaningPaths = {
  /** Dossiers (demandes) : racine du module, écrans du sous-lot 1b. */
  requests: '/nettoyage',
  /** Préfixe des fiches dossier (sous-lot 1b), rattachées à l'onglet « Dossiers ». */
  requestPrefix: '/nettoyage/dossiers',
  /** Fiche d'un dossier. */
  request: (value: string) => `/nettoyage/dossiers/${id(value)}`,
  visits: '/nettoyage/visites',
  planning: '/nettoyage/planning',
  programs: '/nettoyage/programmes',
  /** Ancienne fiche « mission » (v1), encore citée par la facturation et les paiements. */
  missionPrefix: '/nettoyage/missions',
  team: '/nettoyage/equipe',
  claims: '/nettoyage/reclamations',
  catalog: {
    home: CATALOG,
    parameters: `${CATALOG}/parametres`,
    newParameter: `${CATALOG}/parametres/nouveau`,
    parameter: (value: string) => `${CATALOG}/parametres/${id(value)}`,
    categories: `${CATALOG}/categories`,
    newCategory: `${CATALOG}/categories/nouveau`,
    category: (value: string) => `${CATALOG}/categories/${id(value)}`,
    places: `${CATALOG}/lieux`,
    newPlace: (categoryId?: string) =>
      `${CATALOG}/lieux/nouveau${categoryId ? `?categorie=${id(categoryId)}` : ''}`,
    place: (value: string) => `${CATALOG}/lieux/${id(value)}`,
    skills: `${CATALOG}/competences`,
    types: `${CATALOG}/types`,
    newType: `${CATALOG}/types/nouveau`,
    type: (value: string) => `${CATALOG}/types/${id(value)}`,
    offers: `${CATALOG}/offres`,
    newOffer: (placeTypeId?: string) =>
      `${CATALOG}/offres/nouveau${placeTypeId ? `?lieu=${id(placeTypeId)}` : ''}`,
    offer: (value: string) => `${CATALOG}/offres/${id(value)}`,
    simulator: `${CATALOG}/simulateur`,
    /** Simulateur prérempli : lieu, types de nettoyage et brouillons de tarif à essayer. */
    simulate: (
      placeTypeId: string,
      cleaningTypeIds: readonly string[],
      draftTariffIds: readonly string[],
    ) => {
      const query = new URLSearchParams({ lieu: placeTypeId });
      if (cleaningTypeIds.length) query.set('types', cleaningTypeIds.join(','));
      if (draftTariffIds.length) query.set('brouillons', draftTariffIds.join(','));
      return `${CATALOG}/simulateur?${query.toString()}`;
    },
  },
  settings: {
    general: SETTINGS,
    zones: `${SETTINGS}/zones`,
    holidays: `${SETTINGS}/jours-feries`,
  },
} as const;
