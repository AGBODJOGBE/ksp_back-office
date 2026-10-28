/**
 * Rapport de contraste WCAG 2.x entre deux couleurs opaques.
 * Sert à la page de charte (vérification visible des jetons) ; aucune couleur n'est définie ici.
 */
export type Rgb = { r: number; g: number; b: number };

/** Lit `#rgb`, `#rrggbb`, `rgb(r g b)` ou `rgb(r, g, b)`. Renvoie `null` pour tout autre format. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex?.[1]) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const n = Number.parseInt(digits, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[/,]\s*(?:1|1\.0+|100%)\s*)?\)$/.exec(
    value,
  );
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number) as [number, number, number];
    if ([r, g, b].every((c) => c <= 255)) return { r, g, b };
  }
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Niveau atteint pour un texte courant (AA 4,5:1, AAA 7:1) ou un grand texte (AA 3:1). */
export function wcagLevel(ratio: number): 'AAA' | 'AA' | 'AA grand texte' | 'insuffisant' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA grand texte';
  return 'insuffisant';
}
