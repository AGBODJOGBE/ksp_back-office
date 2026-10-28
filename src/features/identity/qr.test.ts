import { matrixPath, qrMatrix } from './qr';

describe('QR code de configuration', () => {
  it('regroupe les modules sombres d’une ligne en segments', () => {
    expect(
      matrixPath([
        [true, true, false, true],
        [false, false, false, false],
        [false, true, true, true],
      ]),
    ).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM1 2h3v1h-3z');
  });

  it('calcule le QR code d’une adresse otpauth dans la page, avec sa marge', async () => {
    const uri =
      'otpauth://totp/KSP:%2B2290197000001?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=KSP&algorithm=SHA1&digits=6&period=30';
    const { size, path } = await qrMatrix(uri);
    // Version 6 ou 7 (41 ou 45 modules) + 2 × 4 de marge.
    expect([49, 53]).toContain(size);
    expect(path.startsWith('M4 4h7')).toBe(true);
  });
});
