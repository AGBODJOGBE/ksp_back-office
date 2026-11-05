/** Textes du tableau de bord « Ma journée ». */
export const dashboardTexts = {
  eyebrow: 'Ma journée',
  title: 'Ma journée',
  lead: 'Ce qui attend une action de votre part, du plus urgent au moins urgent. Chaque ligne mène à l’écran où l’action se fait.',
  today: (date: string) => `Aujourd’hui, ${date} (heure du Bénin)`,
  queueTitle: 'À traiter',
  loading: 'Chargement de la file…',
  sectionLoading: (title: string) => `Chargement : ${title}…`,
  retry: 'Réessayer',
  nothing: 'Rien à traiter',
  allClear: 'Tout est à jour : rien à traiter pour le moment.',
  noQueue: 'Aucune file « À traiter » ne correspond à vos rôles pour le moment. Vos modules sont ci-dessous.',
  count: (label: string) => `${label} à traiter`,
  countMore: (count: number) => `${count} ou plus à traiter`,
  moreRows: (shown: number) => `Les ${shown} premiers sont affichés.`,
  actionFor: (action: string, title: string) => `${action} : ${title}`,
  modulesTitle: 'Vos modules',
} as const;
