/** Textes des zones desservies. Séparés des textes communs : chaque page ne charge que les siens. */

export const zonesTexts = {
  title: 'Zones desservies',
  lead: 'Communes où le Nettoyage est ouvert. Une demande hors zone est refusée par la gateway ; les missions en cours continuent.',
  caption: 'Zones desservies',
  empty: 'Aucune zone.',
  columns: { commune: 'Commune', code: 'Clé', state: 'État', updated: 'Modifiée' },
  active: 'Ouverte',
  inactive: 'Désactivée',
  neverUpdated: 'Zone de départ',
  updated: (date: string, by: string) => `${date} par ${by}`,
  add: 'Ouvrir une commune',
  commune: 'Commune',
  communeHint: 'Nom de la commune, par exemple Sèmè-Podji.',
  addConfirm: 'Ouvrir la zone',
  reactivate: 'Réactiver',
  deactivate: {
    label: 'Désactiver',
    title: (commune: string) => `Désactiver ${commune} ?`,
    text: 'Les nouvelles demandes de devis y seront refusées. Les missions en cours continuent.',
    confirm: 'Désactiver la zone',
  },
  adminOnly: 'Les zones desservies sont réservées à l’admin du Nettoyage.',
} as const;
