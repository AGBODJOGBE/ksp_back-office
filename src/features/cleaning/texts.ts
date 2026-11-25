import type { BadgeTone } from '@/components/ui/badge';

/** Textes communs du Nettoyage v2. Un code inconnu retombe sur sa valeur brute. */

const names =
  <K extends string>(entries: Record<K, string>) =>
  (code: K | string): string =>
    (entries as Record<string, string>)[code] ?? code;

export const cleaningTexts = {
  module: 'Nettoyage',
  tabs: {
    label: 'Sections du Nettoyage',
    catalog: 'Catalogue',
    requests: 'Dossiers',
    visits: 'Visites',
    planning: 'Planning',
    programs: 'Programmes',
    team: 'Agents et équipes',
    claims: 'Réclamations',
    settings: 'Réglages',
  },
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    close: 'Fermer',
    sending: 'Envoi…',
    saving: 'Enregistrement…',
    save: 'Enregistrer',
    saved: 'Modifications enregistrées.',
    loadMore: 'Afficher plus',
    loadingMore: 'Chargement de la suite…',
    reference: (id: string) => `Référence pour le support : ${id}.`,
    genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
    required: 'Champ obligatoire.',
    invalidInteger: 'Saisissez un nombre entier.',
    invalidAmount: 'Saisissez un montant en francs CFA, sans décimales.',
    invalidCoefficient: 'Saisissez un multiplicateur, par exemple 1,15 (4 décimales au plus).',
    invalidPercent: 'Saisissez un pourcentage, par exemple 12,5 (2 décimales au plus).',
    invalidCode:
      'De 2 à 50 caractères : lettres minuscules sans accent, chiffres et « _ », en commençant par une lettre.',
    tooLong: (max: number) => `${max} caractères au plus.`,
    between: (min: number, max: number) => `Entre ${min} et ${max}.`,
    fixErrors: 'Corrigez les champs signalés.',
    someone: 'un membre de l’équipe',
    updated: (date: string, name: string) => `Modifié le ${date} par ${name}`,
    none: 'Aucun',
    yes: 'Oui',
    no: 'Non',
    actions: 'Actions',
    state: 'État',
    active: 'Actif',
    inactive: 'Désactivé',
    activeFeminine: 'Active',
    inactiveFeminine: 'Désactivée',
    deactivate: 'Désactiver',
    reactivate: 'Réactiver',
    amountHidden: 'Montant masqué',
    amountHiddenHint: 'Votre compte ne voit pas les montants du Nettoyage.',
    readOnly: 'Lecture seule : la modification est réservée à l’administration du Nettoyage.',
    forbidden: 'Votre rôle ne donne pas accès à cet écran.',
    notFound: 'Élément introuvable : il a peut-être été retiré, ou l’adresse est incomplète.',
    moveUp: (label: string) => `Monter ${label}`,
    moveDown: (label: string) => `Descendre ${label}`,
    remove: (label: string) => `Retirer ${label}`,
    code: 'Code',
    codeHint: 'Identifiant stable, proposé à partir du nom. Il ne change plus après la création.',
    order: 'Ordre d’affichage',
    orderHint: 'Les plus petits nombres s’affichent en premier.',
  },
  comingSoon: {
    badge: 'Bientôt disponible',
    back: 'Ouvrir le catalogue',
  },
  /** Sections du parcours v2 encore provisoires (écrans des livraisons suivantes). */
  placeholders: {
    planning: {
      title: 'Planning',
      lead: 'L’affectation des agents aux séances.',
      coming:
        'Planning des équipes, séances à affecter, contrôle et enregistrement des affectations, planification automatique et propositions à valider.',
    },
    programs: {
      title: 'Programmes',
      lead: 'Les programmes de séances nés des devis acceptés, et le paiement de chaque séance.',
      coming:
        'Liste et fiche des programmes, séances et paiements ; changement d’horaire, avenant, suspension, arrêt ; report, annulation, reprise et clôture d’une séance.',
    },
    program: {
      title: 'Programme de séances',
      lead: 'Le programme né d’un devis accepté : ses séances, leurs agents et leurs paiements.',
      coming: 'Fiche du programme : séances, paiements, changement d’horaire, avenant, suspension et arrêt.',
      back: 'Retour aux dossiers',
    },
    mission: {
      title: 'Mission du Nettoyage',
      lead: 'Les missions de l’ancien Nettoyage sont remplacées par les programmes de séances.',
      coming:
        'Le suivi d’un programme, de ses séances et de leurs paiements arrive avec les écrans des programmes.',
    },
    team: {
      title: 'Agents et équipes',
      lead: 'Les agents de terrain, leurs candidatures, leurs disponibilités et leurs équipes.',
      coming:
        'Agents et candidatures (invitation, vérification, validation, suspension), disponibilités, indisponibilités et équipes.',
    },
    claims: {
      title: 'Réclamations',
      lead: 'Les réclamations des clients après une séance.',
      coming:
        'File des réclamations : prise en charge, réponse au client, décision et validation d’un crédit.',
    },
  },
} as const;

/** Raisons du masquage sur le portail (`visibilityReasons`, R-CA-12). */
export const visibilityReason = names({
  inactive: 'désactivé',
  category_inactive: 'catégorie désactivée',
  no_active_offer: 'aucune offre active',
  type_inactive: 'type de nettoyage désactivé',
});

/** Mode de planification (R-PL-05). */
export const planningMode = names({
  manual: 'Manuel',
  proposal: 'Proposition à valider',
  automatic: 'Automatique',
});

/** État d'un élément du catalogue : actif ou désactivé (jamais supprimé, R-CA-06). */
export function activeBadge(active: boolean, feminine = false): { label: string; tone: BadgeTone } {
  const t = cleaningTexts.common;
  if (active) return { label: feminine ? t.activeFeminine : t.active, tone: 'success' };
  return { label: feminine ? t.inactiveFeminine : t.inactive, tone: 'neutral' };
}

/** Nom affiché lu dans identity, ou libellé court quand il manque. */
export const nameOr = (name: string | null | undefined, fallback: string) => name?.trim() || fallback;
