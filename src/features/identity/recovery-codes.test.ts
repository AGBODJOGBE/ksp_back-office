import { cleanRecoveryCode, groupSecret, isRecoveryCodeComplete, recoveryCodesFile } from './recovery-codes';

describe('codes de récupération et clé de configuration', () => {
  it('écrit un fichier lisible : en-tête, puis un code par ligne', () => {
    const text = recoveryCodesFile(
      ['7KQ2M-X9PDA', 'H4TZ8-0RWNC'],
      '+2290197000001',
      new Date('2026-10-28T09:30:00Z'),
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe('KSP Back-office — codes de récupération');
    expect(lines[1]).toBe('Compte : +2290197000001');
    // Heure du Bénin (UTC+1).
    expect(lines[2]).toMatch(/^Remis le : 28 octobre 2026 .*10:30$/);
    expect(lines.slice(-3)).toEqual(['7KQ2M-X9PDA', 'H4TZ8-0RWNC', '']);
  });

  it('groupe la clé par 4 caractères', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('ABCDEF')).toBe('ABCD EF');
  });

  it('nettoie un code de récupération saisi', () => {
    expect(cleanRecoveryCode(' 7kq2m-x9pda ')).toBe('7KQ2M-X9PDA');
    expect(cleanRecoveryCode('7kq2m x9pda')).toBe('7KQ2MX9PDA');
    expect(isRecoveryCodeComplete('7KQ2M-X9PDA')).toBe(true);
    expect(isRecoveryCodeComplete('7KQ2MX9PDA')).toBe(true);
    expect(isRecoveryCodeComplete('7KQ2M-X9PD')).toBe(false);
  });
});
