import { contrastRatio, parseColor, wcagLevel } from './contrast';

describe('contraste des couleurs', () => {
  it('lit les notations hexadécimales et rgb()', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor(' #0C1B33 ')).toEqual({ r: 12, g: 27, b: 51 });
    expect(parseColor('rgb(12, 27, 51)')).toEqual({ r: 12, g: 27, b: 51 });
    expect(parseColor('rgb(12 27 51 / 1)')).toEqual({ r: 12, g: 27, b: 51 });
  });

  it('refuse les couleurs translucides ou inconnues', () => {
    expect(parseColor('rgb(255 255 255 / 0.12)')).toBeNull();
    expect(parseColor('color-mix(in srgb, red, blue)')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });

  it('calcule le rapport WCAG', () => {
    const white = parseColor('#ffffff')!;
    const black = parseColor('#000000')!;
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, parseColor('#9e5a1f')!)).toBeCloseTo(5.34, 1);
  });

  it('classe le niveau atteint', () => {
    expect(wcagLevel(7.2)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(3.2)).toBe('AA grand texte');
    expect(wcagLevel(2)).toBe('insuffisant');
  });
});
