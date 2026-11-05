/** Textes des visites techniques (liste et compte rendu). Séparés des textes communs : chaque page ne charge que les siens. */

export const visitsTexts = {
  title: 'Visites techniques',
  lead: 'Visites des lieux, obligatoires avant tout devis. Un agent ne voit que les visites qui lui sont affectées.',
  caption: 'Visites techniques',
  empty: 'Aucune visite pour ces critères.',
  statusFilter: 'État',
  periodFilter: 'Période',
  periods: {
    past: 'Heure passée',
    upcoming: 'À venir',
  },
  columns: {
    visit: 'Visite',
    requests: 'Demandes',
    place: 'Lieu',
    agent: 'Agent',
    status: 'État',
    actions: 'Actions',
  },
  scheduledAt: (date: string) => `Prévue le ${date}`,
  completedAt: (date: string) => `Réalisée le ${date}`,
  groupVisit: 'Visite commune à plusieurs demandes',
  unnamedService: 'Prestation',
  seeRequest: (service: string) => `Voir la demande : ${service}`,
  noAction: 'Aucune action',
  report: {
    label: 'Compte rendu',
    labelFor: (service: string) => `Compte rendu : ${service}`,
    accessibleLabel: (service: string, customer: string) => `Compte rendu : ${service}, ${customer}`,
    title: 'Compte rendu de la visite',
    summary: (service: string, date: string, commune: string) => `${service} · ${date} · ${commune}`,
    field: 'Constats de la visite',
    hint: 'Surface, accès, état des lieux : ce qui sert à établir le devis. 5 000 caractères au plus.',
    confirm: 'Enregistrer le compte rendu',
    done: (service: string, customer: string) => `Compte rendu enregistré : ${service}, ${customer}.`,
  },
} as const;
