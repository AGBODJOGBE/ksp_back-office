/** Textes des sections du Nettoyage dans la file « À traiter » de Ma journée (sous-lot 1c-4). */
export const cleaningQueueTexts = {
  visitToSchedule: {
    title: 'Visites à planifier',
    description: 'Dossiers dont les frais de visite sont réglés : la visite technique reste à fixer.',
    seeAll: 'Voir les dossiers à planifier',
    action: 'Planifier la visite',
  },
  visitDone: {
    title: 'Devis à préparer',
    description: 'Dossiers dont la visite est faite : les valeurs retenues et le devis restent à établir.',
    seeAll: 'Voir les dossiers visités',
    action: 'Préparer le devis',
  },
  unassigned: {
    title: 'Interventions à affecter',
    description: 'Visites et séances sans équipe complète, les plus urgentes d’abord.',
    seeAll: 'Ouvrir le planning',
    action: 'Affecter',
    late: 'En retard',
    urgent: 'Urgent',
  },
  applications: {
    title: 'Candidatures d’agents',
    description: 'Candidatures déposées ou en vérification : pièces, compétences, puis validation ou refus.',
    seeAll: 'Voir les candidatures',
    action: 'Examiner',
  },
  claims: {
    title: 'Réclamations à traiter',
    description:
      'Nouvelles réclamations à prendre en charge sous 24 h, puis celles en cours à décider ou à valider.',
    seeAll: 'Voir les réclamations',
    late: 'Plus de 24 h sans réponse',
    open: 'Ouvrir',
  },
  dossier: (number: string) => `Dossier ${number}`,
  noName: 'Nom indisponible',
} as const;
