import { publicEnv } from './env';

/** Identité de l'outil et liens vers les sites publics de l'écosystème. */
export const siteConfig = {
  id: 'backoffice',
  name: 'KSP Back-office',
  domain: 'admin.ksp.bj',
  tagline: "L'outil de l'équipe KSP",
  description: "Outil interne de l'équipe KSP : chaque agent ne voit que les modules de ses rôles.",
  url: publicEnv.siteUrl,
  locale: 'fr_BJ',
  ecosystem: [
    { id: 'portail', label: 'KSP', href: publicEnv.portailUrl },
    { id: 'shop', label: 'KSP Shop', href: publicEnv.shopUrl },
    { id: 'print', label: 'KSP Print', href: publicEnv.printUrl },
  ],
} as const;
