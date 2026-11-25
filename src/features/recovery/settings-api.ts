import { path, read, send } from './api';
import {
  type Holiday,
  holidaysSchema,
  type Settings,
  type SettingsView,
  settingsViewSchema,
} from './settings-schemas';

/** Réglages du recouvrement et jours fériés (jours ouvrés lun-ven, hors fériés). */

export const getSettings = (): Promise<SettingsView> => read(settingsViewSchema, path('settings'));

/** Remplace les réglages ; les dossiers en cours gardent les délais déjà calculés. */
export const updateSettings = (settings: Settings): Promise<SettingsView> =>
  send(settingsViewSchema, 'put', path('settings'), settings);

export async function getHolidays(year: number): Promise<Holiday[]> {
  return (await read(holidaysSchema, path('holidays', String(year)))).holidays;
}

/** Remplace la liste de l'année (40 jours au plus). */
export async function setHolidays(year: number, holidays: Holiday[]): Promise<Holiday[]> {
  return (await send(holidaysSchema, 'put', path('holidays', String(year)), { holidays })).holidays;
}
