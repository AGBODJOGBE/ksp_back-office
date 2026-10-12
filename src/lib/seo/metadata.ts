import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

/** Métadonnées d'une page : titre, description, aperçu de partage. */
export function pageMetadata(input: { title?: string; description?: string; path?: string }): Metadata {
  const description = input.description ?? siteConfig.description;
  const url = new URL(input.path ?? '/', siteConfig.url).toString();
  return {
    title: input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title ?? siteConfig.name,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: 'website',
    },
  };
}
