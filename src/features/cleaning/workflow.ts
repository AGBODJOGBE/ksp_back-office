import type { QuoteRequest } from './schemas';

/*
 * Choix de l'action proposée en premier sur une demande ou un groupe, à partir des seuls états renvoyés par
 * la gateway (`status`, `visit`, `quote`, `groupSize`). Confort d'affichage : la gateway reste seule juge et
 * refuse une action que l'état ne permet pas.
 */

/** États d'une demande encore ouverte à une visite ou à un devis. */
const OPEN = new Set(['received', 'visit_scheduled', 'quote_sent']);

export type PrimaryKind = 'schedule_visit' | 'report' | 'quote' | 'mission';

export interface PrimaryAction {
  kind: PrimaryKind;
  /** `group` : l'action se fait sur la vue du groupe (visite commune, compte rendu commun, devis groupés). */
  scope: 'request' | 'group';
}

const isGrouped = (request: Pick<QuoteRequest, 'groupId' | 'groupSize'>) =>
  !!request.groupId && request.groupSize > 1;

/**
 * Action principale d'une demande :
 * - `received` (ou visite annulée) : planifier la visite ;
 * - visite planifiée : saisir le compte rendu ;
 * - visite faite, sans devis : établir le devis ;
 * - `quote_sent` : aucune (le renvoi reste une action secondaire) ;
 * - `accepted` : voir la mission.
 * Dans un groupe de plus d'une demande, la visite et le devis se font sur la vue du groupe ; une visite
 * propre à la demande (détachée de la visite commune) garde son compte rendu sur la fiche.
 */
export function primaryAction(
  request: Pick<QuoteRequest, 'status' | 'visit' | 'quote' | 'missionId' | 'groupId' | 'groupSize'>,
): PrimaryAction | null {
  const { status, visit, quote } = request;
  if (status === 'accepted') return request.missionId ? { kind: 'mission', scope: 'request' } : null;
  if (!OPEN.has(status) || status === 'quote_sent') return null;
  const grouped = isGrouped(request);
  if (visit?.status === 'scheduled') {
    return { kind: 'report', scope: grouped && visit.groupVisitId ? 'group' : 'request' };
  }
  if (visit?.status === 'completed') {
    return quote ? null : { kind: 'quote', scope: grouped ? 'group' : 'request' };
  }
  return { kind: 'schedule_visit', scope: grouped ? 'group' : 'request' };
}

export type GroupActionKind = 'visit' | 'report' | 'quotes';

/** Demandes que l'on peut encore visiter, chiffrer ou refuser (ni acceptées, ni closes). */
export const isOpen = (request: Pick<QuoteRequest, 'status'>) => OPEN.has(request.status);

/** Demandes du groupe que les devis groupés peuvent viser : ouvertes, visite des lieux réalisée. */
export const isQuotable = (request: Pick<QuoteRequest, 'status' | 'visit'>) =>
  isOpen(request) && request.visit?.status === 'completed';

/** Visite commune encore planifiée (compte rendu commun possible). */
export const hasScheduledGroupVisit = (requests: ReadonlyArray<Pick<QuoteRequest, 'status' | 'visit'>>) =>
  requests.some((r) => isOpen(r) && r.visit?.status === 'scheduled' && !!r.visit.groupVisitId);

/**
 * Action principale d'un groupe : compte rendu commun si la visite commune est planifiée ; sinon visite
 * commune s'il reste une demande sans visite ; sinon devis groupés s'il reste une demande visitée sans
 * devis ; sinon aucune.
 */
export function groupPrimaryAction(
  requests: ReadonlyArray<Pick<QuoteRequest, 'status' | 'visit' | 'quote'>>,
): GroupActionKind | null {
  if (hasScheduledGroupVisit(requests)) return 'report';
  const open = requests.filter((r) => isOpen(r) && r.status !== 'quote_sent');
  if (open.some((r) => !r.visit || r.visit.status === 'cancelled')) return 'visit';
  if (open.some((r) => r.visit?.status === 'completed' && !r.quote)) return 'quotes';
  return null;
}

/** Nombre saisi en français ou en anglais (« 6,3703 » ou « 6.3703 ») ; `undefined` si vide, `NaN` s'il est invalide. */
export function decimal(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return undefined;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export type LocationField = 'latitude' | 'longitude' | 'accuracyMeters' | 'landmark' | 'commune';

/**
 * Lit la boîte « Corriger la position » selon le contrat (`CorrectCleaningRequestLocationRequest`) :
 * latitude de −90 à 90, longitude de −180 à 180, précision de 0 à 100 000 m (facultative), repère de 1 à 500
 * caractères et commune de 1 à 100 caractères (facultatifs, absents s'ils sont vides). Renvoie le corps, ou le
 * premier champ en défaut.
 */
export function readLocationInput(values: Record<LocationField, string>):
  | {
      ok: true;
      input: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        landmark?: string;
        commune?: string;
      };
    }
  | { ok: false; field: LocationField } {
  const latitude = decimal(values.latitude);
  if (latitude === undefined || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, field: 'latitude' };
  }
  const longitude = decimal(values.longitude);
  if (longitude === undefined || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, field: 'longitude' };
  }
  const accuracy = decimal(values.accuracyMeters);
  if (accuracy !== undefined && (Number.isNaN(accuracy) || accuracy < 0 || accuracy > 100_000)) {
    return { ok: false, field: 'accuracyMeters' };
  }
  const landmark = values.landmark.trim();
  if (landmark.length > 500) return { ok: false, field: 'landmark' };
  const commune = values.commune.trim();
  if (commune.length > 100) return { ok: false, field: 'commune' };
  return {
    ok: true,
    input: {
      latitude,
      longitude,
      ...(accuracy !== undefined ? { accuracyMeters: accuracy } : {}),
      ...(landmark ? { landmark } : {}),
      ...(commune ? { commune } : {}),
    },
  };
}
