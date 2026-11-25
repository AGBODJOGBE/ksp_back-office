import type { Permission } from './roles-schemas';

/** Règles d'affichage des rôles dynamiques (ADR-057) : groupes de cases, différences, permissions retirées. */

export interface PermissionGroup {
  service: string;
  modules: { module: string; permissions: Permission[] }[];
}

/**
 * Catalogue → groupes par service puis module (deuxième segment du code), dans l'ordre de la gateway
 * (déjà trié par service, module puis code).
 */
export function groupPermissions(catalog: readonly Permission[]): PermissionGroup[] {
  const groups: PermissionGroup[] = [];
  for (const permission of catalog) {
    let group = groups.find((entry) => entry.service === permission.service);
    if (!group) {
      group = { service: permission.service, modules: [] };
      groups.push(group);
    }
    let block = group.modules.find((entry) => entry.module === permission.module);
    if (!block) {
      block = { module: permission.module, permissions: [] };
      group.modules.push(block);
    }
    block.permissions.push(permission);
  }
  return groups;
}

/** Permissions ajoutées et retirées entre deux listes (ordre de la nouvelle liste, puis de l'ancienne). */
export function permissionChanges(
  before: readonly string[],
  after: readonly string[],
): { added: string[]; removed: string[] } {
  return {
    added: after.filter((code) => !before.includes(code)),
    removed: before.filter((code) => !after.includes(code)),
  };
}

/**
 * Permissions d'un rôle que le catalogue ne déclare plus (ou marque retirées) : elles n'entrent plus
 * dans les jetons, la fiche les signale (ADR-057, décision 1).
 */
export function retiredPermissions(granted: readonly string[], catalog: readonly Permission[]): string[] {
  const active = new Set(catalog.filter((entry) => !entry.retired).map((entry) => entry.code));
  return granted.filter((code) => !active.has(code));
}

/** Libellé d'une permission : sa description dans le catalogue, sinon son code. */
export function permissionLabel(code: string, catalog: readonly Permission[]): string {
  return catalog.find((entry) => entry.code === code)?.description || code;
}
