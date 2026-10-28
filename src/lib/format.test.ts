import { beninInputToIso, formatDuration, formatSlot, formatXof, isoToBeninInput } from './format';

const plain = (value: string) => value.replace(/\s/g, ' ');

describe('formats d’affichage', () => {
  it('affiche des entiers de FCFA, sans décimales ni division par 100', () => {
    expect(plain(formatXof(45000))).toBe('45 000 F CFA');
    expect(plain(formatXof({ amount: 3500, currency: 'XOF' }))).toBe('3 500 F CFA');
  });

  it('affiche les créneaux à l’heure du Bénin, quel que soit le fuseau du poste', () => {
    expect(plain(formatSlot({ start: '2026-11-05T08:00:00Z', end: '2026-11-05T11:00:00Z' }))).toBe(
      'jeu. 5 nov. 2026, 09:00 – 12:00',
    );
  });

  it('convertit un champ datetime-local (heure du Bénin) en UTC, et inversement', () => {
    expect(beninInputToIso('2026-11-05T09:00')).toBe('2026-11-05T08:00:00.000Z');
    expect(isoToBeninInput('2026-11-05T08:00:00Z')).toBe('2026-11-05T09:00');
    expect(beninInputToIso('')).toBeNull();
    expect(beninInputToIso('05/11/2026')).toBeNull();
  });

  it('écrit les durées en heures et minutes', () => {
    expect(formatDuration(180)).toBe('3 h');
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(45)).toBe('45 min');
  });
});
