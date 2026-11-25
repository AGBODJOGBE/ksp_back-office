'use client';

import { SubNav, type SubNavItem } from '@/components/ui/sub-nav';
import { SUPER_ADMIN } from '@/config/modules';
import { useSession } from '@/lib/api';
import { accountPaths, rolePaths, roleTexts } from '@/features/identity/accounts';

/**
 * Onglets du module Administration : comptes (attribution des rôles), et rôles pour le super
 * administrateur seul (routes `/admin/identity/roles/{code}` et `/permissions`, `x-ksp-roles`
 * `super_admin`). Affichage seulement : la gateway reste seule juge.
 */
export function administrationTabs(roles: readonly string[]): SubNavItem[] {
  const tabs: SubNavItem[] = [{ href: accountPaths.list, label: roleTexts.nav.accounts }];
  if (roles.includes(SUPER_ADMIN)) tabs.push({ href: rolePaths.list, label: roleTexts.nav.roles });
  return tabs;
}

export function AdministrationTabs() {
  const current = useSession();
  if (!current) return <div className="border-line -mx-gutter min-h-11 border-b" aria-hidden="true" />;
  return <SubNav label={roleTexts.nav.label} items={administrationTabs(current.roles)} />;
}
