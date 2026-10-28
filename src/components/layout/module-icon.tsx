import type { JSX } from 'react';
import {
  IconBell,
  IconDashboard,
  IconImmobilier,
  IconImpression,
  IconLivraison,
  IconMarketplace,
  IconNettoyage,
  IconRecouvrement,
  IconSettings,
  IconUsers,
  IconWallet,
  type IconProps,
} from '@/components/ui/icons';

const ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  'tableau-de-bord': IconDashboard,
  recouvrement: IconRecouvrement,
  nettoyage: IconNettoyage,
  finance: IconWallet,
  clients: IconUsers,
  notifications: IconBell,
  administration: IconSettings,
  immobilier: IconImmobilier,
  impression: IconImpression,
  livraison: IconLivraison,
  marketplace: IconMarketplace,
};

/** Icône d'un module du catalogue (décorative : le libellé du module est toujours affiché à côté). */
export function ModuleIcon({ slug, ...props }: IconProps & { slug: string }) {
  const Icon = ICONS[slug] ?? IconDashboard;
  return <Icon {...props} />;
}
