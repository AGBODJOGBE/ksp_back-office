import type { CleaningSettings } from './schemas';

/** Textes des réglages du Nettoyage : réglages généraux, zones desservies, jours fériés. */

type NumberKey = {
  [K in keyof CleaningSettings]-?: CleaningSettings[K] extends number ? K : never;
}[keyof CleaningSettings];

export interface NumberSetting {
  key: NumberKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Rappel du contrat (valeur par défaut, règle). */
  hint: string;
}

export interface SettingsGroup {
  id: string;
  title: string;
  numbers: readonly NumberSetting[];
  flags?: readonly { key: 'deductVisitFee' | 'balanceGuarantee'; label: string; hint: string }[];
}

/** Réglages bornés du contrat (`CleaningSettings`, partie 16.1), groupés par étape du parcours. */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: 'demandes',
    title: 'Demandes et visites',
    numbers: [
      {
        key: 'maxOpenRequestsPerAccount',
        label: 'Demandes ouvertes par compte',
        unit: '',
        min: 1,
        max: 100,
        hint: 'Défaut : 5.',
      },
      {
        key: 'minVisitLeadHours',
        label: 'Délai minimum avant une visite',
        unit: 'h',
        min: 0,
        max: 168,
        hint: 'Défaut : 24 h.',
      },
      {
        key: 'visitFeePaymentHours',
        label: 'Délai de paiement des frais de visite',
        unit: 'h',
        min: 1,
        max: 168,
        hint: 'Défaut : 72 h.',
      },
      {
        key: 'visitTargetBusinessHours',
        label: 'Objectif de délai de visite',
        unit: 'h ouvrées',
        min: 24,
        max: 240,
        hint: 'Défaut : 72 h ouvrées.',
      },
      {
        key: 'visitDurationMinutes',
        label: 'Durée d’une visite',
        unit: 'min',
        min: 15,
        max: 480,
        hint: 'Défaut : 60 min.',
      },
      {
        key: 'defaultTravelMinutes',
        label: 'Temps de trajet si le calcul d’itinéraire est indisponible',
        unit: 'min',
        min: 0,
        max: 120,
        hint: 'Défaut : 30 min.',
      },
    ],
    flags: [
      {
        key: 'deductVisitFee',
        label: 'Déduire les frais de visite du premier paiement',
        hint: 'Défaut : oui.',
      },
    ],
  },
  {
    id: 'devis',
    title: 'Devis',
    numbers: [
      {
        key: 'quoteValidityDays',
        label: 'Validité d’un devis',
        unit: 'jours',
        min: 1,
        max: 90,
        hint: 'Défaut : 15 jours.',
      },
      {
        key: 'quoteReminderDays',
        label: 'Rappel avant expiration',
        unit: 'jours',
        min: 0,
        max: 30,
        hint: 'Défaut : 2 jours ; 0 : aucun rappel. Plus court que la validité.',
      },
      {
        key: 'maxDiscountWithoutApprovalPercent',
        label: 'Remise maximale sans validation d’un administrateur',
        unit: '%',
        min: 0,
        max: 100,
        hint: 'Défaut : 20 %.',
      },
    ],
  },
  {
    id: 'programmes',
    title: 'Programmes et séances',
    numbers: [
      {
        key: 'firstSessionLeadHours',
        label: 'Délai minimum avant la première séance',
        unit: 'h',
        min: 0,
        max: 720,
        hint: 'Défaut : 48 h.',
      },
      {
        key: 'programMaxMonths',
        label: 'Durée maximale d’un programme',
        unit: 'mois',
        min: 1,
        max: 60,
        hint: 'Défaut : 24 mois.',
      },
      {
        key: 'programMaxSessions',
        label: 'Nombre maximum de séances',
        unit: '',
        min: 1,
        max: 1000,
        hint: 'Défaut : 400.',
      },
      {
        key: 'freeCancellationHours',
        label: 'Annulation ou report sans frais jusqu’à',
        unit: 'h avant',
        min: 0,
        max: 168,
        hint: 'Défaut : 24 h avant.',
      },
      {
        key: 'reschedulesPerMonth',
        label: 'Reports par mois',
        unit: '',
        min: 0,
        max: 10,
        hint: 'Défaut : 2.',
      },
      {
        key: 'lateCancellationFeePercent',
        label: 'Frais d’annulation tardive ou de client absent',
        unit: '%',
        min: 0,
        max: 100,
        hint: 'Défaut : 50 %.',
      },
    ],
  },
  {
    id: 'paiements',
    title: 'Paiements et suspensions',
    numbers: [
      {
        key: 'sessionPaymentGraceHours',
        label: 'Délai de paiement d’une séance (particulier)',
        unit: 'h',
        min: 1,
        max: 168,
        hint: 'Défaut : 24 h.',
      },
      {
        key: 'overdueSessionsBeforeSuspension',
        label: 'Séances en retard avant suspension',
        unit: '',
        min: 1,
        max: 10,
        hint: 'Défaut : 1.',
      },
      {
        key: 'unpaidInvoicesWarning',
        label: 'Factures impayées avant avertissement',
        unit: '',
        min: 1,
        max: 12,
        hint: 'Défaut : 1.',
      },
      {
        key: 'unpaidInvoicesSuspension',
        label: 'Factures impayées avant suspension',
        unit: '',
        min: 1,
        max: 12,
        hint: 'Défaut : 2 ; plus grand que le seuil d’avertissement.',
      },
    ],
    flags: [{ key: 'balanceGuarantee', label: 'Garantie de solde avant une séance', hint: 'Défaut : non.' }],
  },
  {
    id: 'planification',
    title: 'Planification et agents',
    numbers: [
      {
        key: 'planningHorizonDays',
        label: 'Horizon de la planification automatique',
        unit: 'jours',
        min: 1,
        max: 60,
        hint: 'Défaut : 14 jours.',
      },
      {
        key: 'assignmentResponseHours',
        label: 'Délai d’acceptation d’une affectation (indépendants)',
        unit: 'h',
        min: 1,
        max: 72,
        hint: 'Défaut : 12 h.',
      },
      {
        key: 'defaultMaxHoursPerDay',
        label: 'Charge maximale d’un agent par jour',
        unit: 'h',
        min: 1,
        max: 24,
        hint: 'Défaut : 8 h ; au plus la charge par semaine.',
      },
      {
        key: 'defaultMaxHoursPerWeek',
        label: 'Charge maximale d’un agent par semaine',
        unit: 'h',
        min: 1,
        max: 168,
        hint: 'Défaut : 48 h.',
      },
    ],
  },
  {
    id: 'execution',
    title: 'Exécution des séances',
    numbers: [
      {
        key: 'maxPhotosPerKind',
        label: 'Photos par type et par séance',
        unit: '',
        min: 1,
        max: 50,
        hint: 'Défaut : 10.',
      },
      {
        key: 'arrivalAlertMeters',
        label: 'Distance d’alerte à l’arrivée',
        unit: 'm',
        min: 50,
        max: 5000,
        hint: 'Défaut : 300 m.',
      },
      {
        key: 'arrivalMaxAdvanceMinutes',
        label: 'Avance maximale à l’arrivée',
        unit: 'min',
        min: 0,
        max: 240,
        hint: 'Défaut : 30 min ; 0 : pas de contrôle.',
      },
      {
        key: 'customerWaitMinutes',
        label: 'Attente avant de déclarer le client absent',
        unit: 'min',
        min: 10,
        max: 120,
        hint: 'Défaut : 30 min.',
      },
    ],
  },
  {
    id: 'reclamations',
    title: 'Réclamations et conservation',
    numbers: [
      {
        key: 'claimWindowHours',
        label: 'Fenêtre de réclamation',
        unit: 'h',
        min: 12,
        max: 168,
        hint: 'Défaut : 48 h.',
      },
      {
        key: 'retentionMonths',
        label: 'Conservation des positions et des photos',
        unit: 'mois',
        min: 1,
        max: 120,
        hint: 'Défaut : 12 mois.',
      },
    ],
  },
];

export const settingsTexts = {
  title: 'Réglages',
  lead: 'Les règles du module, bornées par le serveur et tracées au journal d’audit. Une modification vaut pour les nouveaux dossiers.',
  defaultVisitFee: 'Frais de visite par défaut (FCFA)',
  defaultVisitFeeHint: 'Appliqués aux catégories sans frais propres.',
  planningMode: 'Mode de planification par défaut',
  planningModeHint: 'Défaut : proposition à valider. Une zone peut avoir son propre mode.',
  weights: 'Poids du score des candidats',
  weightsHint: 'Le total doit faire 100. Défauts : continuité 40, proximité 25, équilibre 20, note 15.',
  weightNames: {
    continuity: 'Continuité',
    proximity: 'Proximité',
    balance: 'Équilibre de charge',
    rating: 'Note',
  },
  weightsTotal: (total: number) => `Total : ${total} sur 100`,
  checklist: 'Points communs de toutes les séances',
  checklistHint: 'Ajoutés à la liste de contrôle de chaque type de nettoyage (50 au plus).',
  save: 'Enregistrer les réglages',
  nothingChanged: 'Aucune modification à enregistrer.',
  zones: {
    title: 'Zones desservies',
    lead: 'Les communes où KSP intervient. Le coefficient de commune et la majoration des frais de visite s’appliquent aux nouvelles demandes.',
    open: 'Ouvrir une commune',
    commune: 'Commune',
    communeHint: 'Référentiel officiel des communes ; seules celles sans zone sont proposées.',
    chooseCommune: 'Choisissez une commune',
    communesUnavailable: 'Le référentiel des communes est indisponible pour le moment.',
    noCommuneLeft: 'Toutes les communes du référentiel ont déjà une zone.',
    name: 'Nom affiché',
    nameHint: 'Facultatif : nom officiel de la commune s’il est vide.',
    coefficient: 'Coefficient de commune',
    coefficientHint: 'Multiplicateur du prix : 1 = neutre (défaut), 1,10 = +10 %.',
    surcharge: 'Majoration des frais de visite (FCFA)',
    surchargeHint: 'Facultatif : montant fixe ajouté aux frais de visite dans cette commune.',
    surchargeLocked: 'Une majoration fixée se modifie mais ne se retire pas (le contrat ne le permet pas).',
    planningMode: 'Mode de planification',
    planningModeHint: 'Vide : réglage général.',
    general: 'Réglage général',
    caption: 'Zones desservies',
    empty: 'Aucune zone : ouvrez une première commune.',
    columns: {
      zone: 'Zone',
      coefficient: 'Coefficient',
      surcharge: 'Majoration',
      planning: 'Planification',
      activity: 'En cours',
      state: 'État',
    },
    activity: (requests: number, programs: number) => `${requests} demande(s), ${programs} programme(s)`,
    edit: 'Modifier',
    editTitle: (name: string) => `Modifier la zone ${name}`,
    deactivateTitle: (name: string) => `Désactiver la zone ${name} ?`,
    deactivateText: 'Aucune nouvelle demande n’y sera acceptée. Les dossiers en cours vont à leur terme.',
    deactivateActivity: (requests: number, programs: number) =>
      `Cette zone a ${requests} demande(s) ouverte(s) et ${programs} programme(s) actif(s) : ils iront à leur terme. Confirmez la désactivation.`,
    created: (name: string) => `Zone ${name} ouverte.`,
  },
  holidays: {
    title: 'Jours fériés',
    lead: 'Proposés à l’exclusion des programmes. Ajouter ou retirer un jour ne change pas les séances déjà créées.',
    year: 'Année',
    add: 'Ajouter un jour férié',
    date: 'Date',
    name: 'Nom',
    caption: (year: number) => `Jours fériés ${year}`,
    empty: (year: number) => `Aucun jour férié enregistré pour ${year}.`,
    columns: { date: 'Date', name: 'Jour férié' },
    remove: 'Retirer',
    removeTitle: (name: string) => `Retirer « ${name} » ?`,
    removeText:
      'Il ne sera plus proposé à l’exclusion des nouveaux programmes. Les séances déjà créées ne changent pas.',
  },
} as const;
