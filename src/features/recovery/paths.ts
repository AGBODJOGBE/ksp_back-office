/** Adresses des écrans du Recouvrement dans le back-office. */

const id = (value: string) => encodeURIComponent(value);
const ROOT = '/recouvrement';
const CASES = `${ROOT}/dossiers`;
const PRICING = `${ROOT}/tarification`;
const SETTINGS = `${ROOT}/reglages`;
const INVOICES = `${ROOT}/factures`;

/**
 * Filtres de la file des dossiers lus dans l'adresse (paramètres en français), traduits pour
 * `GET /recovery/cases` : le tableau de bord y mène ; la file les lit (`case-logic.ts`). La recherche
 * (`recherche`) est lue si elle arrive, mais jamais écrite : un nom de débiteur n'entre pas dans l'adresse.
 */
export const CASE_PARAMS = {
  status: 'statut',
  stage: 'etape',
  kind: 'offre',
  agentId: 'charge',
  creditorId: 'creancier',
  communeKey: 'commune',
  search: 'recherche',
  idleDays: 'inactifs',
  prescriptionNear: 'prescription',
} as const;
export type CaseFilterKey = keyof typeof CASE_PARAMS;
export type CaseFilters = Partial<Record<CaseFilterKey, string | number | boolean>>;

function withQuery(base: string, filters: CaseFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters) as [CaseFilterKey, string | number | boolean][]) {
    if (value !== undefined && value !== '') query.set(CASE_PARAMS[key], String(value));
  }
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

export const recoveryPaths = {
  /** Tableau de bord : racine du module. */
  home: ROOT,
  /** File des dossiers. */
  cases: CASES,
  /** File des dossiers filtrée (`CASE_PARAMS`). */
  casesWith: (filters: CaseFilters) => withQuery(CASES, filters),
  /** Fiche d'un dossier. */
  case: (value: string) => `${CASES}/${id(value)}`,
  /** Paiements hors ligne à valider. */
  offlinePayments: `${ROOT}/paiements-hors-ligne`,
  pricing: PRICING,
  newRule: `${PRICING}/nouvelle`,
  rule: (value: string) => `${PRICING}/${id(value)}`,
  /** Nouvelle version d'une règle publiée (`previousVersionId`). */
  newVersion: (value: string) => `${PRICING}/nouvelle?version-de=${id(value)}`,
  simulator: `${PRICING}/simulateur`,
  settings: SETTINGS,
  holidays: `${SETTINGS}/jours-feries`,
  invoices: INVOICES,
  invoice: (value: string) => `${INVOICES}/${id(value)}`,
  /** Factures de commission d'un créancier (filtre `creancier` de la liste des factures). */
  invoicesOf: (creditorId: string) => `${INVOICES}?creancier=${id(creditorId)}`,
} as const;
