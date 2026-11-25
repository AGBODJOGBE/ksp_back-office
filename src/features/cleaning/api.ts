import type * as z from 'zod/mini';
import { api, parseResponse } from '@/lib/api';
import {
  type CleaningSettings,
  type CleaningType,
  cleaningTypeListSchema,
  cleaningTypeSchema,
  type Commune,
  communeListSchema,
  type Holiday,
  holidayListSchema,
  holidaySchema,
  type Offer,
  offerListSchema,
  offerSchema,
  type Page,
  type Parameter,
  type ParameterChoice,
  type ParameterKind,
  parameterListSchema,
  parameterSchema,
  type PlaceCategory,
  placeCategoryListSchema,
  placeCategorySchema,
  type PlaceType,
  placeTypeListSchema,
  placeTypeSchema,
  type PlanningMode,
  type Simulation,
  settingsSchema,
  simulationSchema,
  type Skill,
  skillListSchema,
  skillSchema,
  type Tariff,
  tariffListSchema,
  tariffSchema,
  type TeamRuleBracket,
  type Zone,
  zoneListSchema,
  zoneSchema,
  type ChecklistItem,
  type FrequencyCoefficient,
} from './schemas';

/**
 * Appels du Nettoyage v2 (contrat `ksp-api.v1.yaml`, routes `/api/v1/admin/cleaning/*`), sous-lot 1a :
 * catalogue (catégories, lieux, types, paramètres, offres, tarifs), simulateur, compétences, jours
 * fériés, zones et communes, réglages. Chaque réponse est validée par son schéma. Les créations, la
 * publication d'un tarif et l'activation d'une zone portent la clé d'idempotence exigée par le contrat,
 * tirée par l'écran à l'ouverture du formulaire et renvoyée telle quelle à chaque nouvel essai.
 */
const ADMIN = '/api/v1/admin/cleaning';

export const PAGE_SIZE = 20;
/** Taille de page la plus grande du contrat (listes de choix complètes). */
const FULL_PAGE = 100;
/** Garde-fou des lectures complètes : au plus 10 pages (1 000 éléments). */
const MAX_PAGES = 10;

export const path = (...segments: string[]) => [ADMIN, ...segments.map(encodeURIComponent)].join('/');

export type Query = Record<string, string | number | undefined>;
type PageSchema<T> = z.ZodMiniType<Page<T>>;

export async function read<S extends z.ZodMiniType>(
  schema: S,
  url: string,
  query?: Query,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api.get(url, { query }));
}

/** Une page d'une liste : `limit` du contrat (20 par défaut), curseur opaque. */
export function listPage<T>(schema: PageSchema<T>, url: string, query: Query = {}) {
  return (cursor?: string): Promise<Page<T>> => read(schema, url, { limit: PAGE_SIZE, ...query, cursor });
}

/** Toute une liste (choix d'un lieu, d'un paramètre…), page après page, sans dépasser `MAX_PAGES`. */
export async function readAll<T>(schema: PageSchema<T>, url: string, query: Query = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const result: Page<T> = await read(schema, url, { ...query, limit: FULL_PAGE, cursor });
    items.push(...result.data);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return items;
}

/** Nombre d'éléments d'une liste (`total`), lu sur une page d'un élément. */
async function count<T>(schema: PageSchema<T>, url: string): Promise<number> {
  const result: Page<T> = await read(schema, url, { limit: 1 });
  return result.total;
}

async function create<S extends z.ZodMiniType>(
  schema: S,
  url: string,
  body: unknown,
  idempotencyKey: string,
): Promise<z.infer<S>> {
  return parseResponse(schema, await api.post(url, body, { idempotencyKey }));
}

async function patch<S extends z.ZodMiniType>(schema: S, url: string, body: unknown): Promise<z.infer<S>> {
  return parseResponse(schema, await api.patch(url, body));
}

/** `CleaningAmountInput` : entier en FCFA. */
export interface AmountInput {
  amount: number;
  currency: 'XOF';
}
export const xof = (amount: number): AmountInput => ({ amount, currency: 'XOF' });

// --- Paramètres ----------------------------------------------------------------------------------

export interface ParameterBody {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  choices?: ParameterChoice[];
  required: boolean;
  help?: string;
}
export type CreateParameterBody = ParameterBody & { code: string; kind: ParameterKind };
export type UpdateParameterBody = Partial<ParameterBody> & { active?: boolean };

export const listParameters = (cursor?: string) => listPage(parameterListSchema, path('parameters'))(cursor);
export const allParameters = () => readAll(parameterListSchema, path('parameters'));
export const countParameters = () => count(parameterListSchema, path('parameters'));
export const getParameter = (id: string) => read(parameterSchema, path('parameters', id));
export const createParameter = (body: CreateParameterBody, key: string): Promise<Parameter> =>
  create(parameterSchema, path('parameters'), body, key);
export const updateParameter = (id: string, body: UpdateParameterBody): Promise<Parameter> =>
  patch(parameterSchema, path('parameters', id), body);

// --- Catégories de lieu --------------------------------------------------------------------------

export interface PlaceCategoryBody {
  name: string;
  icon?: string;
  order?: number;
  visitFee?: AmountInput;
}
export type CreatePlaceCategoryBody = PlaceCategoryBody & { code: string };
export type UpdatePlaceCategoryBody = Partial<PlaceCategoryBody> & { active?: boolean };

export const listPlaceCategories = (cursor?: string) =>
  listPage(placeCategoryListSchema, path('place-categories'))(cursor);
export const allPlaceCategories = () => readAll(placeCategoryListSchema, path('place-categories'));
export const countPlaceCategories = () => count(placeCategoryListSchema, path('place-categories'));
export const getPlaceCategory = (id: string) => read(placeCategorySchema, path('place-categories', id));
export const createPlaceCategory = (body: CreatePlaceCategoryBody, key: string): Promise<PlaceCategory> =>
  create(placeCategorySchema, path('place-categories'), body, key);
export const updatePlaceCategory = (id: string, body: UpdatePlaceCategoryBody): Promise<PlaceCategory> =>
  patch(placeCategorySchema, path('place-categories', id), body);

// --- Lieux ---------------------------------------------------------------------------------------

export interface PlaceTypeBody {
  categoryId: string;
  name: string;
  icon?: string;
  description?: string;
  order?: number;
  freeDescription?: boolean;
  parameterIds: string[];
  areaParameterId?: string;
}
export type CreatePlaceTypeBody = PlaceTypeBody & { code: string };
export type UpdatePlaceTypeBody = Partial<PlaceTypeBody> & { active?: boolean };

export const listPlaceTypes = (categoryId?: string) =>
  listPage(placeTypeListSchema, path('place-types'), { categoryId });
export const allPlaceTypes = () => readAll(placeTypeListSchema, path('place-types'));
export const countPlaceTypes = () => count(placeTypeListSchema, path('place-types'));
export const getPlaceType = (id: string) => read(placeTypeSchema, path('place-types', id));
export const createPlaceType = (body: CreatePlaceTypeBody, key: string): Promise<PlaceType> =>
  create(placeTypeSchema, path('place-types'), body, key);
export const updatePlaceType = (id: string, body: UpdatePlaceTypeBody): Promise<PlaceType> =>
  patch(placeTypeSchema, path('place-types', id), body);

// --- Compétences ---------------------------------------------------------------------------------

export const listSkills = (cursor?: string) => listPage(skillListSchema, path('skills'))(cursor);
export const allSkills = () => readAll(skillListSchema, path('skills'));
export const countSkills = () => count(skillListSchema, path('skills'));
export const createSkill = (body: { code: string; name: string }, key: string): Promise<Skill> =>
  create(skillSchema, path('skills'), body, key);
export const updateSkill = (id: string, body: { name?: string; active?: boolean }): Promise<Skill> =>
  patch(skillSchema, path('skills', id), body);

// --- Types de nettoyage --------------------------------------------------------------------------

export interface CleaningTypeBody {
  name: string;
  description?: string;
  icon?: string;
  requiredSkillCode?: string;
  referenceDurationMinutes: number;
  checklist: ChecklistItem[];
  isPack?: boolean;
  packItemIds?: string[];
}
export type CreateCleaningTypeBody = CleaningTypeBody & { code: string };
export type UpdateCleaningTypeBody = Partial<CleaningTypeBody> & { active?: boolean };

export const listCleaningTypes = (cursor?: string) =>
  listPage(cleaningTypeListSchema, path('cleaning-types'))(cursor);
export const allCleaningTypes = () => readAll(cleaningTypeListSchema, path('cleaning-types'));
export const countCleaningTypes = () => count(cleaningTypeListSchema, path('cleaning-types'));
export const getCleaningType = (id: string) => read(cleaningTypeSchema, path('cleaning-types', id));
export const createCleaningType = (body: CreateCleaningTypeBody, key: string): Promise<CleaningType> =>
  create(cleaningTypeSchema, path('cleaning-types'), body, key);
export const updateCleaningType = (id: string, body: UpdateCleaningTypeBody): Promise<CleaningType> =>
  patch(cleaningTypeSchema, path('cleaning-types', id), body);

// --- Offres et tarifs ----------------------------------------------------------------------------

export interface OfferBody {
  extraParameterIds: string[];
  teamRule: TeamRuleBracket[];
  order?: number;
}
export type CreateOfferBody = OfferBody & { placeTypeId: string; cleaningTypeId: string; active?: boolean };
export type UpdateOfferBody = Partial<OfferBody> & { active?: boolean };

export const listOffers = (filters: { placeTypeId?: string; cleaningTypeId?: string } = {}) =>
  listPage(offerListSchema, path('offers'), filters);
export const allOffers = (filters: { placeTypeId?: string; cleaningTypeId?: string } = {}) =>
  readAll(offerListSchema, path('offers'), filters);
export const countOffers = () => count(offerListSchema, path('offers'));
export const getOffer = (id: string) => read(offerSchema, path('offers', id));
export const createOffer = (body: CreateOfferBody, key: string): Promise<Offer> =>
  create(offerSchema, path('offers'), body, key);
export const updateOffer = (id: string, body: UpdateOfferBody): Promise<Offer> =>
  patch(offerSchema, path('offers', id), body);

/** `CleaningCreateTariffDraftBody` / `CleaningUpdateTariffDraftBody`. */
export interface TariffBody {
  baseParameterCode?: string;
  brackets: { from: number; to: number; mode: 'flat' | 'per_unit'; amount: AmountInput }[];
  supplements: {
    parameterCode: string;
    choiceCode?: string;
    mode: 'fixed' | 'per_unit' | 'coefficient';
    amount?: AmountInput;
    coefficientBps?: number;
    includedUnits?: number;
  }[];
  minimum: AmountInput;
  frequencyCoefficients: FrequencyCoefficient[];
  packDiscountBps?: number;
}

/** Versions du tarif d'une offre, la plus récente d'abord. */
export const listTariffs = (offerId: string) => (cursor?: string) =>
  read(tariffListSchema, path('offers', offerId, 'tariffs'), { limit: PAGE_SIZE, cursor });
export const createTariffDraft = (offerId: string, body: TariffBody, key: string): Promise<Tariff> =>
  create(tariffSchema, path('offers', offerId, 'tariffs'), body, key);
export const updateTariffDraft = async (offerId: string, version: number, body: TariffBody) =>
  parseResponse(tariffSchema, await api.put(path('offers', offerId, 'tariffs', String(version)), body));
export const publishTariff = async (offerId: string, version: number, key: string) =>
  parseResponse(
    tariffSchema,
    await api.post(path('offers', offerId, 'tariffs', String(version), 'publish'), undefined, {
      idempotencyKey: key,
    }),
  );

// --- Simulateur ----------------------------------------------------------------------------------

export type Values = Record<string, number | string | boolean>;

/** `CleaningSchedulePlan` (partie des champs proposée par le simulateur du back-office). */
export interface SchedulePlan {
  kind: 'one_off' | 'weekly' | 'monthly';
  startTime: string;
  dates?: string[];
  weekdays?: string[];
  everyWeeks?: number;
  monthDays?: number[];
  startDate?: string;
  durationWeeks?: number;
  durationMonths?: number;
  excludeHolidays?: boolean;
}

export interface SimulationBody {
  placeTypeId: string;
  cleaningTypeIds: string[];
  values: Values;
  schedule?: SchedulePlan;
  communeKey?: string;
  draftTariffIds: string[];
}

/** Calcul de test : jamais enregistré, accepte les brouillons et les éléments inactifs (R-CA-08). */
export const simulate = async (body: SimulationBody): Promise<Simulation> =>
  parseResponse(simulationSchema, await api.post(path('simulations'), body));

// --- Jours fériés --------------------------------------------------------------------------------

export const listHolidays = (year: number) => listPage(holidayListSchema, path('holidays'), { year });
export const createHoliday = (body: { date: string; name: string }, key: string): Promise<Holiday> =>
  create(holidaySchema, path('holidays'), body, key);
export const deleteHoliday = (id: string): Promise<void> => api.delete(path('holidays', id));

// --- Zones et communes ---------------------------------------------------------------------------

export interface ZoneBody {
  name?: string;
  coefficientBps?: number;
  visitFeeSurcharge?: AmountInput;
  planningMode?: PlanningMode;
}

export const listZones = (cursor?: string) => listPage(zoneListSchema, path('zones'))(cursor);
export const allZones = () => readAll(zoneListSchema, path('zones'));
export const createZone = (body: ZoneBody & { communeKey: string }, key: string): Promise<Zone> =>
  create(zoneSchema, path('zones'), body, key);
export const updateZone = (id: string, body: ZoneBody): Promise<Zone> =>
  patch(zoneSchema, path('zones', id), body);
/** Activer ou désactiver ; `confirm` : désactiver malgré des dossiers en cours. */
export const setZoneActive = (
  id: string,
  body: { active: boolean; confirm?: boolean },
  key: string,
): Promise<Zone> => create(zoneSchema, path('zones', id, 'activation'), body, key);
export const listCommunes = async (): Promise<Commune[]> =>
  (await read(communeListSchema, path('communes'))).data;

// --- Réglages ------------------------------------------------------------------------------------

export type SettingsBody = Partial<
  Omit<CleaningSettings, 'updatedAt' | 'updatedBy' | 'updatedByName' | 'defaultVisitFee'>
> & { defaultVisitFee?: AmountInput };

export const getSettings = () => read(settingsSchema, path('settings'));
export const updateSettings = (body: SettingsBody): Promise<CleaningSettings> =>
  patch(settingsSchema, path('settings'), body);
