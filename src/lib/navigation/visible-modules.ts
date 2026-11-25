import {
  type BackofficeModule,
  CURRENT_PHASE,
  MODULE_GROUPS,
  type ModuleGroup,
  MODULES,
  MODULES_WITH_SCREENS,
  SUPER_ADMIN,
} from '@/config/modules';
import { fromRoles, type Grants, hasAnyPermission } from '@/lib/grants';

export interface ModuleGroupEntry {
  id: ModuleGroup;
  label: string;
  modules: BackofficeModule[];
}

/**
 * Modules rangés par groupe du menu, dans l'ordre des groupes puis du catalogue ; un groupe sans module
 * n'apparaît pas. Reçoit des modules déjà filtrés (`visibleModules`).
 */
export function groupModules(
  modules: readonly BackofficeModule[],
  groups: readonly { id: ModuleGroup; label: string }[] = MODULE_GROUPS,
): ModuleGroupEntry[] {
  return groups
    .map((group) => ({ ...group, modules: modules.filter((module) => module.group === group.id) }))
    .filter((group) => group.modules.length > 0);
}

/** Le module est-il ouvert à ces droits (phase mise à part) ? */
function opens(module: BackofficeModule, grants: Grants): boolean {
  if (grants.roles.includes(SUPER_ADMIN) || module.roles.includes('*')) return true;
  return module.permissions
    ? hasAnyPermission(grants, module.permissions, module.roles)
    : module.roles.some((role) => grants.roles.includes(role));
}

/**
 * Modules visibles par un agent selon ses droits et la phase en cours : sert au menu et aux pages
 * d'attente. Un module qui déclare des permissions (ADR-057) suit les permissions du jeton, les autres
 * suivent les rôles. Simple confort d'affichage, pas une protection : les droits viennent du jeton
 * délivré par la gateway, et le backend les contrôle à chaque appel (un module masqué ici reste refusé
 * là-bas).
 */
export function visibleModules(
  grants: Grants,
  phase: number = CURRENT_PHASE,
  modules: readonly BackofficeModule[] = MODULES,
): BackofficeModule[] {
  return modules.filter((module) => module.phase <= phase && opens(module, grants));
}

/** Le module figure-t-il dans le menu de l'agent ? Affichage seulement, comme `visibleModules`. */
export function isModuleVisible(slug: string, grants: Grants, phase: number = CURRENT_PHASE): boolean {
  return visibleModules(grants, phase).some((module) => module.slug === slug);
}

/**
 * Modules de la phase en cours qui n'ont encore qu'une page d'attente (`[module]`) : ni le tableau de
 * bord (l'accueil), ni les modules qui ont leurs propres écrans.
 */
export function waitingModules(
  phase: number = CURRENT_PHASE,
  withScreens: readonly string[] = MODULES_WITH_SCREENS,
): BackofficeModule[] {
  return visibleModules(fromRoles([SUPER_ADMIN]), phase).filter(
    (module) => module.slug !== 'tableau-de-bord' && !withScreens.includes(module.slug),
  );
}
