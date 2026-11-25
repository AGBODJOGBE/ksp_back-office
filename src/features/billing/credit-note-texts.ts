/** Textes des avoirs (R-PE-07) : liste du module Finance, section et émission sur la fiche d'une facture. */

/** Émetteur d'un avoir : compte du back-office, ou le service Nettoyage (`service:cleaning`). */
export const issuerLabel = (issuedBy: string, me?: string) =>
  issuedBy === 'service:cleaning' ? 'Nettoyage (automatique)' : issuedBy === me ? 'Vous' : 'Équipe KSP';

export const creditNoteTexts = {
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement de la suite…',
  cancel: 'Annuler',
  pending: 'Envoi…',
  list: {
    title: 'Avoirs',
    lead: 'Une facture émise ne se modifie jamais : une erreur se corrige par un avoir, émis depuis la fiche de la facture. L’avoir réduit d’abord le reste dû ; au-delà, il est crédité au portefeuille du client.',
    caption: 'Avoirs émis',
    empty: 'Aucun avoir émis pour le moment.',
    emptyFiltered: 'Aucun avoir ne correspond à ce filtre.',
    filters: 'Filtres en cours',
    byInvoice: 'Facture sélectionnée',
    byCustomer: 'Client sélectionné',
    byOrganization: 'Entreprise sélectionnée',
    removeFilter: (label: string) => `Retirer le filtre « ${label} »`,
    forbidden: 'Les avoirs sont réservés à la finance.',
    columns: {
      number: 'Avoir',
      invoice: 'Facture',
      total: 'Montant',
      split: 'Imputation',
      reason: 'Motif',
      issued: 'Émis le',
    },
    invoiceLink: (number: string) => `Facture ${number}`,
    applied: (amount: string) => `Sur le reste dû : ${amount}`,
    credited: (amount: string) => `Au portefeuille : ${amount}`,
    issuedBy: (who: string) => `Par : ${who}`,
  },
  section: {
    title: 'Avoirs',
    caption: 'Avoirs de la facture',
    none: 'Aucun avoir sur cette facture.',
    creditable: (amount: string) => `Encore possible en avoir : ${amount}.`,
    nothingLeft: 'Le total des avoirs atteint déjà le total de la facture : aucun nouvel avoir possible.',
    cancelled: 'Facture annulée : aucun avoir possible.',
  },
  issue: {
    open: 'Émettre un avoir',
    title: 'Émettre un avoir',
    lead: 'Lignes positives et motif visible du client. L’avoir réduit d’abord le reste dû ; la part au-delà est créditée au portefeuille du client.',
    max: (amount: string) =>
      `Montant total au plus ${amount} (total de la facture moins les avoirs déjà émis).`,
    lineLegend: (index: number) => `Ligne ${index}`,
    label: 'Libellé',
    labelHint: '200 caractères au plus, par exemple « Séance du 12 novembre facturée deux fois ».',
    amount: 'Montant (FCFA)',
    amountHint: 'Nombre entier, sans espace.',
    addLine: 'Ajouter une ligne',
    removeLine: (index: number) => `Retirer la ligne ${index}`,
    reason: 'Motif',
    reasonHint: 'Obligatoire, 500 caractères au plus. Visible du client.',
    total: 'Total de l’avoir',
    review: 'Vérifier',
    reviewTitle: 'Confirmer l’avoir',
    reviewLead: 'Vérifiez avant d’envoyer : un avoir émis ne se modifie pas et ne s’annule pas.',
    split: (applied: string, credited: string) =>
      `Imputé sur le reste dû : ${applied}. Crédité au portefeuille du client : ${credited}.`,
    back: 'Modifier',
    confirm: (amount: string) => `Émettre l’avoir de ${amount}`,
    labelRequired: 'Indiquez le libellé de chaque ligne.',
    invalidAmount: 'Saisissez un montant en FCFA, nombre entier supérieur à 0.',
    reasonRequired: 'Indiquez le motif.',
    exceeds: (max: string) => `Le total dépasse ce qui reste possible en avoir (${max}).`,
    done: (number: string, total: string) => `Avoir ${number} de ${total} émis.`,
    already: (number: string) => `L’avoir ${number} avait déjà été émis : rien n’a été ajouté.`,
  },
  errors: {
    exceeds: 'Le total des avoirs dépasserait le total de la facture : la fiche a été actualisée.',
    cancelled: 'Cette facture est annulée : aucun avoir possible. La fiche a été actualisée.',
    reused:
      'Un avoir a déjà été émis avec cette demande. Fermez la fenêtre et vérifiez les avoirs avant de recommencer.',
  },
} as const;
