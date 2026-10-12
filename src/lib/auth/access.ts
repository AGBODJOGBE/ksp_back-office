import { type BackofficeModule, CURRENT_PHASE, MODULES, SUPER_ADMIN } from '@/config/modules';

/**
 * Modules visibles par un agent selon ses rôles. Simple confort d'affichage :
 * le contrôle réel des droits est fait par le backend à chaque appel.
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

export function canAccessModule(
  slug: string,
  roles: readonly string[],
  phase: number = CURRENT_PHASE,
): boolean {
  return visibleModules(roles, phase).some((module) => module.slug === slug);
}
