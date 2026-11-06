/** Textes du formulaire d'une prestation, des mesures constatées (ADR-037) et du prix recalculé. */

export const measureTexts = {
  form: {
    required: 'Réponse obligatoire.',
    integer: 'Saisissez un nombre entier, sans virgule.',
    range: (min: number | null, max: number | null) =>
      min !== null && max !== null
        ? `Entre ${min} et ${max}.`
        : min !== null
          ? `${min} au moins.`
          : `${max ?? ''} au plus.`,
    bounds: (min: number | null, max: number | null) =>
      min !== null && max !== null ? `De ${min} à ${max}.` : null,
    yes: 'Oui',
    frequency: 'Fréquence',
    options: 'Options',
    optionHint: 'Cochez les options retenues : leurs questions s’affichent dessous.',
    choose: 'Choisissez',
    requiredMark: '(obligatoire)',
    declared: (value: string) => `Déclaré par le client : ${value}`,
    declaredNone: 'Non renseigné par le client',
    changed: 'Modifié',
  },
  price: {
    title: 'Prix recalculé',
    announced: 'Prix annoncé au client',
    recalculated: 'Prix avec ces réponses',
    pending: 'Calcul en cours…',
    waiting: 'Complétez les réponses obligatoires pour voir le prix.',
    notPriced: 'Prix non fixé : un tarif manque dans le catalogue.',
    missingTitle: 'Tarifs à compléter dans le catalogue',
    missing: {
      field: (label: string) => `Prix par unité de « ${label} »`,
      choice: (field: string, choice: string) => `Effet de la valeur « ${choice} » (${field})`,
      boolean: (label: string) => `Effet de la réponse « Oui » à « ${label} »`,
      option: (label: string) => `Forfait de l’option « ${label} »`,
    },
    range: (low: string, high: string) => `Fourchette : ${low} – ${high}`,
    team: (count: number) => `Équipe conseillée : ${count} agent${count > 1 ? 's' : ''}`,
    details: 'Détail du calcul',
    uncovered: 'Commune hors des zones desservies : le prix est indicatif.',
  },
  measures: {
    title: 'Mesures constatées',
    lead: 'Corrigez ce que vous avez constaté sur place : le prix se recalcule automatiquement. Les réponses du client ne sont jamais modifiées.',
    agentLead:
      'Saisissez ce que vous constatez sur place : le prix se recalcule automatiquement. Les réponses du client restent visibles pour le superviseur.',
    savedBy: (date: string, by: string) => `Mesures saisies le ${date} par ${by}.`,
    someone: 'un membre de l’équipe',
    noForm:
      'Formulaire de la prestation indisponible (prestation désactivée ou catalogue injoignable) : les mesures ne peuvent pas être saisies.',
    loadingForm: 'Chargement du formulaire…',
    locked:
      'Un devis a déjà été envoyé ou la demande est close : les mesures ne peuvent plus être modifiées. Une nouvelle visite les rouvre.',
    report: 'Compte rendu de la visite',
    reportHint: 'Accès, état des lieux, remarques utiles au devis. 5 000 caractères au plus.',
    saveWithReport: 'Clore la visite avec ces mesures',
    closeTitle: 'Clore la visite ?',
    closeText:
      'La visite sera marquée « réalisée » et les mesures à l’écran enregistrées avec votre compte rendu. Le devis pourra ensuite être envoyé.',
    closeConfirm: 'Clore la visite',
    saveOnly: 'Enregistrer les mesures seulement',
    save: 'Enregistrer les mesures',
    saved: 'Mesures enregistrées. Le devis sera prérempli avec ce calcul.',
    savedWithReport: 'Compte rendu et mesures enregistrés : la visite est réalisée.',
    reportRequired: 'Écrivez le compte rendu, ou enregistrez les mesures seules.',
    fixErrors: 'Corrigez les réponses signalées.',
    reset: 'Reprendre les réponses du client',
    compareTitle: 'Déclaré par le client et constaté',
    compareCaption: 'Réponses du client et mesures constatées',
    columns: { label: 'Question', declared: 'Déclaré par le client', measured: 'Constaté' },
    chosen: 'Choisie',
    notChosen: 'Non choisie',
    option: (label: string) => `Option « ${label} »`,
    gap: 'Écart',
    same: 'Identique',
    gaps: (count: number) =>
      count
        ? `${count} écart${count > 1 ? 's' : ''} avec la demande du client.`
        : 'Aucun écart avec la demande.',
    open: 'Saisir les mesures',
    openFor: (service: string) => `Mesures : ${service}`,
    close: 'Fermer les mesures',
    panelTitle: (service: string) => `Mesures constatées · ${service}`,
  },
} as const;
