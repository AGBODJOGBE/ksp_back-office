import {
  type BackofficeModule,
  CURRENT_PHASE,
  MODULE_GROUPS,
  type ModuleGroup,
  MODULES,
  MODULES_WITH_SCREENS,
  SUPER_ADMIN,
} from '@/config/modules';

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

/**
 * Modules visibles par un agent selon ses rôles et la phase en cours : sert au menu et aux pages d'attente.
 * Simple confort d'affichage, pas une protection : les rôles viennent de la session délivrée par la gateway,
 * et le backend contrôle les droits à chaque appel (un module masqué ici reste refusé là-bas).
 */
export function visibleModules(
  roles: readonly string[],
  phase: number = CURRENT_PHASE,
  modules: readonly BackofficeModule[] = MODULES,
): BackofficeModule[] {
  const isSuperAdmin = roles.includes(SUPER_ADMIN);
  return modules.filter(
    (module) =>
      module.phase <= phase &&
      (isSuperAdmin || module.roles.includes('*') || module.roles.some((role) => roles.includes(role))),
  );
}

/** Le module figure-t-il dans le menu de l'agent ? Affichage seulement, comme `visibleModules`. */
export function isModuleVisible(
  slug: string,
  roles: readonly string[],
  phase: number = CURRENT_PHASE,
): boolean {
  return visibleModules(roles, phase).some((module) => module.slug === slug);
}

/**
 * Modules de la phase en cours qui n'ont encore qu'une page d'attente (`[module]`) : ni le tableau de
 * bord (l'accueil), ni les modules qui ont leurs propres écrans.
 */
export function waitingModules(
  phase: number = CURRENT_PHASE,
  withScreens: readonly string[] = MODULES_WITH_SCREENS,
): BackofficeModule[] {
  return visibleModules([SUPER_ADMIN], phase).filter(
    (module) => module.slug !== 'tableau-de-bord' && !withScreens.includes(module.slug),
  );
}
