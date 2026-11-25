/** Adresses des écrans du Nettoyage v2 dans le back-office. */

const id = (value: string) => encodeURIComponent(value);
const CATALOG = '/nettoyage/catalogue';
const SETTINGS = '/nettoyage/reglages';
const TEAM = '/nettoyage/equipe';

export const cleaningPaths = {
  /** Dossiers (demandes) : racine du module, écrans du sous-lot 1b. */
  requests: '/nettoyage',
  /** Préfixe des fiches dossier (sous-lot 1b), rattachées à l'onglet « Dossiers ». */
  requestPrefix: '/nettoyage/dossiers',
  /** Fiche d'un dossier. */
  request: (value: string) => `/nettoyage/dossiers/${id(value)}`,
  visits: '/nettoyage/visites',
  planning: '/nettoyage/planning',
  /** Planning d'un jour (`AAAA-MM-JJ`, jour du Bénin), en vue « jour ». */
  planningDay: (day: string) => `/nettoyage/planning?vue=jour&date=${id(day)}`,
  programs: '/nettoyage/programmes',
  /** Fiche d'un programme (sous-lot 1c). */
  program: (value: string) => `/nettoyage/programmes/${id(value)}`,
  /** Détail d'une séance, rattaché à la fiche de son programme. */
  session: (programId: string, sessionId: string) =>
    `/nettoyage/programmes/${id(programId)}/seances/${id(sessionId)}`,
  /**
   * Ancienne fiche « mission » (v1), encore citée par la facturation et les paiements : page sobre qui
   * renvoie vers les programmes (aucune correspondance mission → programme dans le contrat).
   */
  missionPrefix: '/nettoyage/missions',
  /** Agents et équipes (sous-lot 1c) : la liste des agents est la page d'accueil de l'onglet. */
  team: TEAM,
  agentPrefix: `${TEAM}/agents`,
  agent: (value: string) => `${TEAM}/agents/${id(value)}`,
  newAgent: `${TEAM}/agents/nouveau`,
  teams: `${TEAM}/equipes`,
  teamDetail: (value: string) => `${TEAM}/equipes/${id(value)}`,
  newTeam: `${TEAM}/equipes/nouvelle`,
  claims: '/nettoyage/reclamations',
  /** Fiche d'une réclamation (sous-lot 1c-4). */
  claim: (value: string) => `/nettoyage/reclamations/${id(value)}`,
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
