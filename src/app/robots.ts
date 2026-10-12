import type { MetadataRoute } from 'next';

/** Outil interne : aucun robot n'est autorisé. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
