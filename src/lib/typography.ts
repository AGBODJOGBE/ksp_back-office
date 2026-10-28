const NBSP = String.fromCharCode(0xa0);

/**
 * Typographie française : espace insécable avant « ? ! : ; » et à l'intérieur des guillemets,
 * pour qu'un signe ne se retrouve jamais seul en début de ligne.
 */
export function frenchSpacing(text: string): string {
  return text.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
}
