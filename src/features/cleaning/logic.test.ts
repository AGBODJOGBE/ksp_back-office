import { ApiError } from '@/lib/api';
import { cleaningAccess } from './access';
import { tabsFor } from './components/cleaning-tabs';
import { errorText, fieldError, placeError } from './errors';
import {
  codeFromLabel,
  coefficientInput,
  formatCoefficient,
  formatPercentBps,
  parseCoefficient,
  parseInteger,
  parsePercentBps,
  uniqueCode,
} from './inputs';

describe('droits d’affichage du Nettoyage v2 (rôles par défaut du contrat)', () => {
  it('admin et super_admin : catalogue, zones et réglages modifiables', () => {
    for (const role of ['cleaning_admin', 'super_admin']) {
      const access = cleaningAccess([role]);
      expect(access['cleaning.catalog.manage']).toBe(true);
      expect(access['cleaning.zone.manage']).toBe(true);
      expect(access['cleaning.settings.manage']).toBe(true);
    }
  });

  it('superviseur : lecture du catalogue, planning, pas de modification du catalogue ni des réglages', () => {
    const access = cleaningAccess(['cleaning_supervisor']);
    expect(access['cleaning.catalog.read']).toBe(true);
    expect(access['cleaning.catalog.manage']).toBe(false);
    expect(access['cleaning.settings.manage']).toBe(false);
    expect(access['cleaning.planning.manage']).toBe(true);
  });

  it('support : lecture et réclamations ; agent de terrain : rien au back-office', () => {
    const support = cleaningAccess(['support_agent']);
    expect(support['cleaning.catalog.read']).toBe(true);
    expect(support['cleaning.claim.manage']).toBe(true);
    expect(support['cleaning.planning.manage']).toBe(false);
    expect(Object.values(cleaningAccess(['cleaning_agent'])).some(Boolean)).toBe(false);
  });

  it('onglets du parcours v2, dans l’ordre, filtrés par permission', () => {
    const labels = (roles: string[]) => tabsFor(cleaningAccess(roles)).map((tab) => tab.label);
    expect(labels(['cleaning_admin'])).toEqual([
      'Catalogue',
      'Dossiers',
      'Visites',
      'Planning',
      'Programmes',
      'Agents et équipes',
      'Réclamations',
      'Réglages',
    ]);
    expect(labels(['support_agent'])).toEqual([
      'Catalogue',
      'Dossiers',
      'Visites',
      'Programmes',
      'Réclamations',
      'Réglages',
    ]);
    expect(labels(['finance_officer'])).toEqual([]);
  });
});

describe('saisies du catalogue (sans calcul)', () => {
  it('entiers et montants : espaces tolérés, décimales refusées', () => {
    expect(parseInteger('12 500')).toBe(12500);
    expect(parseInteger('12,5')).toBeNull();
    expect(parseInteger('-3')).toBeNull();
    expect(parseInteger('')).toBeNull();
  });

  it('coefficients : multiplicateur saisi ↔ points de base exacts', () => {
    expect(parseCoefficient('1,15')).toBe(11500);
    expect(parseCoefficient('0.9')).toBe(9000);
    expect(parseCoefficient('1')).toBe(10000);
    expect(parseCoefficient('1,00005')).toBeNull();
    expect(parseCoefficient('abc')).toBeNull();
    expect(coefficientInput(11500)).toBe('1,15');
    expect(coefficientInput(10000)).toBe('1');
    expect(formatCoefficient(9000)).toBe('× 0,9');
  });

  it('pourcentages en points de base : 12,5 % ↔ 1250', () => {
    expect(parsePercentBps('12,5')).toBe(1250);
    expect(parsePercentBps('90')).toBe(9000);
    expect(formatPercentBps(1250)).toBe('12,5 %');
  });

  it('codes tirés des libellés, au format du contrat, uniques', () => {
    expect(codeFromLabel('Après travaux')).toBe('apres_travaux');
    expect(codeFromLabel('  Salle de fête !')).toBe('salle_de_fete');
    expect(codeFromLabel('2 chambres')).toBe('chambres');
    expect(codeFromLabel('a')).toBe('');
    expect(uniqueCode('sol', ['sol', 'sol_2'])).toBe('sol_3');
  });
});

describe('erreurs du Nettoyage', () => {
  const invalid = (field: string) =>
    new ApiError(400, 'CLEANING_VALIDATION_FAILED', 'Cette valeur est hors des bornes autorisées.', {
      field,
      reason: 'out_of_range',
    });

  it('un champ refusé par la gateway se place sous le champ connu', () => {
    expect(fieldError(invalid('brackets[2].to'))).toEqual({
      field: 'brackets[2].to',
      message: 'Cette valeur est hors des bornes autorisées.',
    });
    expect(placeError(invalid('brackets[2].to'), ['brackets']).field).toBe('brackets[2].to');
    expect(placeError(invalid('inconnu'), ['brackets'])).toEqual({
      field: null,
      message: 'Cette valeur est hors des bornes autorisées.',
    });
  });

  it('tarif incomplet : raison traduite avec le rang de la tranche', () => {
    const error = new ApiError(422, 'CLEANING_TARIFF_INCOMPLETE', 'Ce tarif est incomplet ou incohérent.', {
      reason: 'brackets_gap',
      index: 1,
    });
    expect(errorText(error)).toBe(
      'Il manque des valeurs avant la tranche n° 2 : elle doit commencer juste après la précédente.',
    );
  });

  it('erreur du serveur : message et référence pour le support', () => {
    const error = new ApiError(503, 'CLEANING_GEO_UNAVAILABLE', 'Référentiel indisponible.', {}, 'c-1');
    expect(errorText(error)).toBe('Référentiel indisponible. Référence pour le support : c-1.');
  });
});
