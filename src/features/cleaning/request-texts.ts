/** Textes de la liste des demandes de devis. Séparés des textes communs : chaque page ne charge que les siens. */

export const requestsTexts = {
  title: 'Demandes de devis',
  lead: 'Demandes reçues du portail : visite des lieux obligatoire avant tout devis, puis envoi du devis au client.',
  caption: 'Demandes de devis',
  empty: 'Aucune demande pour ces critères.',
  statusFilter: 'État',
  communeFilter: 'Commune',
  kindFilter: 'Type de client',
  placeFilter: 'Type de lieu',
  serviceFilter: 'Prestation',
  groupFilter: 'Demandes d’un même groupe',
  clearGroup: 'Retirer le filtre du groupe',
  openGroup: 'Ouvrir la vue du groupe',
  columns: {
    request: 'Demande',
    status: 'État',
    customer: 'Client',
    commune: 'Lieu',
    estimate: 'Estimation',
    created: 'Reçue le',
  },
  open: (date: string) => `Demande du ${date}`,
  groupBadge: (size: number) => `Groupe · ${size}`,
  groupBadgeLabel: (size: number) => `Voir le groupe de ${size} demandes pour ce lieu`,
  noEstimate: 'Sans estimation',
  supervisorsOnly:
    'Les demandes de devis sont traitées par les superviseurs et l’admin du Nettoyage. Vos passages sont dans l’onglet Missions.',
} as const;
