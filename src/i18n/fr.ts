/**
 * Textes communs de l'interface, en français.
 * Préparé pour l'anglais (diaspora) : ajouter en.ts avec les mêmes clés.
 */
export const fr = {
  common: {
    backHome: "Retour à l'accueil",
    retry: 'Réessayer',
  },
  errors: {
    notFoundTitle: 'Page introuvable',
    notFoundText: "La page que vous cherchez n'existe pas ou a été déplacée.",
    genericTitle: 'Une erreur est survenue',
    genericText: "Nous n'avons pas pu afficher cette page. Réessayez dans quelques instants.",
  },
} as const;

export type Dictionary = typeof fr;
