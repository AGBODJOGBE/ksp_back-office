/**
 * QR code de configuration de l'application d'authentification, calculé dans le navigateur : le secret
 * ne quitte jamais la page (aucun service extérieur). Bibliothèque `uqr` (MIT, sans dépendance), chargée
 * seulement à l'étape de configuration.
 */
export interface QrMatrix {
  /** Côté du carré, en modules, marge comprise. */
  size: number;
  /** Tracé SVG des modules sombres, un carré d'une unité par module. */
  path: string;
}

/** Tracé SVG d'une matrice de modules (`true` = sombre), lignes regroupées en segments horizontaux. */
export function matrixPath(data: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];
  data.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      parts.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
    }
  });
  return parts.join('');
}

export async function qrMatrix(text: string): Promise<QrMatrix> {
  const { encode } = await import('uqr');
  // Correction M : lisible même sur un écran un peu sale ; marge de 4 modules (norme ISO/IEC 18004).
  const { data, size } = encode(text, { ecc: 'M', border: 4 });
  return { size, path: matrixPath(data) };
}
