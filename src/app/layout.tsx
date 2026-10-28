import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { siteConfig } from '@/config/site';
import { getDictionary } from '@/i18n';
import { displayFont } from './fonts/display';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Outil interne : jamais référencé.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Valeur littérale exigée par la balise meta : jeton --color-canvas (neutral-25).
  themeColor: '#fcfbf8',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const t = getDictionary();
  return (
    <html lang="fr" className={displayFont.variable}>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="focus:bg-brand focus:text-on-brand focus:rounded-control sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-float) focus:px-4 focus:py-3 focus:font-semibold"
        >
          {t.common.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
