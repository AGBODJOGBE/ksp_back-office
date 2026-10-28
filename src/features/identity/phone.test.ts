import { cleanCode, DEFAULT_COUNTRY_CODE, isCodeComplete, toE164 } from './phone';

describe('numéro de téléphone', () => {
  it('propose le Bénin par défaut et garde le 01 des numéros béninois', () => {
    expect(DEFAULT_COUNTRY_CODE).toBe('+229');
    expect(toE164('+229', '01 97 00 00 45')).toBe('+2290197000045');
  });

  it.each([
    ['+229', '01.97.00.00.45', '+2290197000045'],
    ['229', '0197000045', '+2290197000045'],
    ['00229', '01-97-00-00-45', '+2290197000045'],
    ['+33', '6 12 34 56 78', '+33612345678'],
    ['+229', '+33 6 12 34 56 78', '+33612345678'],
    ['+229', '0033612345678', '+33612345678'],
  ])('accepte tout pays au format E.164 (%s, %s)', (code, number, expected) => {
    expect(toE164(code, number)).toBe(expected);
  });

  it.each([
    ['+229', ''],
    ['+229', '12'],
    ['+229', '01 97 AB 00 45'],
    ['+0', '0197000045'],
    ['', '0197000045'],
    ['+229', '+229 01 97 00 00 45 12 34 56'],
  ])('refuse un numéro impossible (%s, %s)', (code, number) => {
    expect(toE164(code, number)).toBeNull();
  });

  it('ne garde que les chiffres du code, 8 au plus', () => {
    expect(cleanCode(' 482 913 ')).toBe('482913');
    expect(cleanCode('12345678901')).toBe('12345678');
    expect(isCodeComplete('482913')).toBe(true);
    expect(isCodeComplete('123')).toBe(false);
  });
});
