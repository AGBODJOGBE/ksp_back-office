/** Textes du tableau de bord du Recouvrement (`GET /recovery/overview`). */

export const overviewTexts = {
  title: 'Tableau de bord',
  lead: 'Dossiers par étape et par offre, sommes confiées et recouvrées, taux de recouvrement, travail en attente.',
  money: {
    title: 'Sommes',
    entrusted: 'Confiées',
    entrustedHint: 'Montants dus des dossiers transmis, hors versements reçus avant le recouvrement.',
    recovered: 'Recouvrées',
    rate: 'Taux de recouvrement',
  },
  queues: {
    title: 'En attente',
    review: 'Recevabilité à décider',
    offline: 'Paiements hors ligne à valider',
    idle: 'Dossiers sans action depuis 7 jours',
    prescriptions: 'Prescriptions proches',
    installments: 'Échéances du jour',
    promises: 'Promesses à vérifier',
    promisesHint: 'Promesses de paiement dont la date est passée.',
    installmentsHint: 'Échéances d’échéancier signé attendues aujourd’hui.',
  },
  byStage: {
    title: 'Dossiers par étape',
    caption: 'Nombre de dossiers en cours par étape',
    empty: 'Aucun dossier en cours.',
    stage: 'Étape',
    count: 'Dossiers',
  },
  byKind: {
    title: 'Dossiers par offre',
    caption: 'Nombre de dossiers par offre',
    empty: 'Aucun dossier.',
    kind: 'Offre',
    count: 'Dossiers',
  },
  rates: {
    title: 'Taux de recouvrement par phase',
    empty: 'Aucune somme recouvrée pour le moment.',
  },
  agents: {
    title: 'Par chargé',
    caption: 'Dossiers et sommes recouvrées par chargé',
    empty: 'Aucun dossier affecté à un chargé.',
    agent: 'Chargé',
    open: 'Dossiers en cours',
    recovered: 'Recouvré',
    rate: 'Taux',
    seeCases: (name: string) => `Voir les dossiers de ${name}`,
  },
  count: (value: number) => `${value} dossier${value > 1 ? 's' : ''}`,
} as const;
