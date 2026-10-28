/**
 * Textes communs de l'interface, en français.
 * Préparé pour l'anglais (diaspora) : ajouter en.ts avec les mêmes clés.
 * Les textes d'un écran vivent dans sa fonctionnalité (`features/<domaine>/texts.ts`).
 */
export const fr = {
  common: {
    skipToContent: 'Aller au contenu',
    backHome: 'Retour au tableau de bord',
    retry: 'Réessayer',
  },
  shell: {
    modules: 'Modules',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    menu: 'Menu',
    loadingMenu: 'Chargement du menu…',
    moduleClosedTitle: (label: string) => `${label} : module non ouvert à vos rôles`,
    moduleClosedText:
      'Ce module n’apparaît pas dans votre menu. Si vous en avez besoin, demandez à un administrateur de vous attribuer le rôle correspondant.',
  },
  errors: {
    notFoundTitle: 'Page introuvable',
    notFoundText: "La page que vous cherchez n'existe pas ou a été déplacée.",
    genericTitle: 'Une erreur est survenue',
    genericText: "Nous n'avons pas pu afficher cette page. Réessayez dans quelques instants.",
  },
} as const;

export type Dictionary = typeof fr;
