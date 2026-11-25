import type { BadgeTone } from '@/components/ui/badge';

/** Textes de ce qui attend la finance dans les portefeuilles : retraits, demandes de crédit, reversements. */

/*
 * Aucun appel de fonction au niveau du module : il reste « pur » et sort du premier chargement du module
 * Finance quand seuls les titres de page en sont lus (index de la fonctionnalité).
 */
type StatusLabel = { label: string; tone: BadgeTone };
const statusOf = (map: Record<string, StatusLabel>, code: string): StatusLabel =>
  map[code] ?? { label: code, tone: 'neutral' };

const WITHDRAWAL: Record<string, StatusLabel> = {
  requested: { label: 'À traiter', tone: 'warning' },
  awaiting_approval: { label: 'À valider', tone: 'warning' },
  submitted: { label: 'Transmis', tone: 'brand' },
  completed: { label: 'Versé', tone: 'success' },
  failed: { label: 'En échec, montant rendu', tone: 'danger' },
  rejected: { label: 'Refusé, montant rendu', tone: 'neutral' },
};
export const withdrawalStatus = (code: string) => statusOf(WITHDRAWAL, code);

const CREDIT_REQUEST: Record<string, StatusLabel> = {
  pending_approval: { label: 'À valider', tone: 'warning' },
  approved: { label: 'Validée, créditée', tone: 'success' },
  rejected: { label: 'Rejetée', tone: 'neutral' },
};
export const creditRequestStatus = (code: string) => statusOf(CREDIT_REQUEST, code);

const WALLET_PAYOUT: Record<string, StatusLabel> = {
  pending_submission: { label: 'En attente de transmission', tone: 'warning' },
  submitted: { label: 'Transmis', tone: 'brand' },
  completed: { label: 'Terminé', tone: 'success' },
  failed: { label: 'En échec, montant rendu', tone: 'danger' },
};
export const walletPayoutStatus = (code: string) => statusOf(WALLET_PAYOUT, code);

const kinds: Record<string, string> = {
  refund: 'Remboursement',
  top_up: 'Recharge reçue avec un écart',
  cash_top_up: 'Recharge en espèces',
  bank_transfer_top_up: 'Virement reçu',
};
export const creditKind = (code: string) => kinds[code] ?? code;

const operators: Record<string, string> = { mtn: 'MTN', moov: 'Moov', celtiis: 'Celtiis' };
export const operatorName = (code: string) => operators[code] ?? code;

const holders: Record<string, string> = { user: 'Particulier', organization: 'Entreprise' };
export const holderKind = (code: string) => holders[code] ?? code;

const common = {
  loading: 'Chargement…',
  retry: 'Réessayer',
  loadMore: 'Afficher plus',
  loadingMore: 'Chargement de la suite…',
  all: 'Tous',
  status: 'État',
  cancel: 'Annuler',
  pending: 'Envoi…',
  holder: 'Titulaire',
  amount: 'Montant',
  action: 'Action',
  seeWallet: (kind: string) => `Ouvrir le portefeuille (${kind})`,
  byHolder: 'Titulaire sélectionné',
  removeHolder: 'Retirer le filtre « Titulaire sélectionné »',
  removeFilter: 'Retirer le filtre',
  you: 'vous',
  colleague: 'un autre membre de la finance',
  reasonField: 'Motif',
  reasonRequired: 'Indiquez le motif.',
};

export const withdrawalTexts = {
  ...common,
  title: 'Retraits',
  lead: 'Retraits du portefeuille prépayé vers Mobile Money demandés par les clients. Une première personne de la finance vérifie et traite la demande, une deuxième la valide : le virement part alors chez payment. Un refus rend le montant au portefeuille.',
  caption: 'Demandes de retrait',
  empty: 'Aucune demande de retrait pour le moment.',
  emptyFiltered: 'Aucune demande de retrait dans cet état.',
  columns: { beneficiary: 'Bénéficiaire', requested: 'Demandé le', progress: 'Suivi' },
  processedBy: (date: string, who: string) => `Traité le ${date} par ${who}`,
  approvedOn: (date: string) => `Validé le ${date}`,
  rejectedOn: (date: string) => `Refusé le ${date}`,
  completedOn: (date: string) => `Versé le ${date}`,
  failedOn: (date: string) => `En échec le ${date}, montant rendu`,
  note: (note: string) => `Vérifications : ${note}`,
  rejection: (reason: string) => `Motif : ${reason}`,
  summary: (amount: string, phone: string, operator: string) => `${amount} vers ${phone} (${operator}).`,
  ownProcessing: 'Traité par vous : une autre personne de la finance doit le valider.',
  process: {
    label: 'Traiter',
    accessibleLabel: (amount: string) => `Traiter le retrait de ${amount}`,
    title: 'Traiter la demande de retrait',
    text: 'Vérifiez le titulaire et le numéro (appel, pièce). La demande attendra ensuite la validation d’une deuxième personne de la finance.',
    field: 'Vérifications faites',
    hint: 'Obligatoire, 500 caractères au plus. Visible du back-office seulement.',
    required: 'Indiquez les vérifications faites.',
    submit: 'Marquer comme traité',
    done: (amount: string) =>
      `Retrait de ${amount} traité : il attend la validation d’une deuxième personne.`,
  },
  approve: {
    label: 'Valider et transmettre',
    accessibleLabel: (amount: string) => `Valider et transmettre le retrait de ${amount}`,
    title: 'Valider le retrait',
    text: 'Le virement Mobile Money sera transmis à payment : cette action est définitive. En cas d’échec du virement, le montant sera rendu au portefeuille.',
    submit: 'Valider et transmettre',
    done: (amount: string) => `Retrait de ${amount} validé et transmis pour le virement.`,
  },
  reject: {
    label: 'Refuser',
    accessibleLabel: (amount: string) => `Refuser le retrait de ${amount}`,
    title: 'Refuser la demande de retrait',
    text: 'Le montant retenu sera rendu au portefeuille du client, qui sera prévenu du motif. Cette action est définitive.',
    hint: 'Obligatoire, 500 caractères au plus. Envoyé au client.',
    submit: 'Refuser le retrait',
    done: (amount: string) => `Retrait de ${amount} refusé : le montant est rendu au portefeuille.`,
  },
  errors: {
    byProcessor: 'Vous avez traité ce retrait : il doit être validé par une autre personne de la finance.',
    stale: 'Ce retrait a changé entre-temps : la liste a été actualisée.',
    notFound: 'Ce retrait est introuvable : la liste a été actualisée.',
  },
};

export const creditRequestTexts = {
  ...common,
  title: 'Demandes de crédit',
  lead: 'Crédits manuels au-delà du seuil de double validation (remboursements, recharges en espèces, virements reçus) : rien n’est crédité tant qu’un autre membre de la finance que l’auteur ne les a pas validés.',
  caption: 'Demandes de crédit manuel',
  empty: 'Aucune demande de crédit pour le moment.',
  emptyFiltered: 'Aucune demande de crédit dans cet état.',
  columns: { kind: 'Type', requested: 'Demandée le', detail: 'Motif et suivi' },
  requestedBy: (date: string, who: string) => `Demandée le ${date} par ${who}`,
  approvedOn: (date: string) => `Validée le ${date}`,
  rejectedOn: (date: string) => `Rejetée le ${date}`,
  receipt: (reference: string) => `Reçu ou virement : ${reference}`,
  rejection: (reason: string) => `Motif du rejet : ${reason}`,
  ownRequest: 'Votre demande : un autre membre de la finance doit la valider.',
  summary: (amount: string, kind: string) => `${amount} · ${kind}.`,
  approve: {
    label: 'Valider et créditer',
    accessibleLabel: (amount: string) => `Valider et créditer ${amount}`,
    title: 'Valider le crédit',
    text: 'Le portefeuille du client sera crédité aussitôt. Une recharge est revérifiée auprès de payment. Cette action est définitive.',
    submit: 'Valider et créditer',
    done: (amount: string, balance: string) =>
      `${amount} crédités sur le portefeuille. Nouveau solde : ${balance}.`,
    already: (balance: string) =>
      `Cette demande était déjà validée : rien n’a été ajouté. Solde : ${balance}.`,
  },
  reject: {
    label: 'Rejeter',
    accessibleLabel: (amount: string) => `Rejeter la demande de ${amount}`,
    title: 'Rejeter la demande de crédit',
    text: 'Rien ne sera crédité. Cette action est définitive.',
    ownText: 'Rien ne sera crédité. Rejeter votre propre demande l’annule. Cette action est définitive.',
    hint: 'Obligatoire, 500 caractères au plus (reçu introuvable en caisse, virement non reçu…).',
    submit: 'Rejeter la demande',
    done: (amount: string) => `Demande de ${amount} rejetée : rien n’a été crédité.`,
  },
  errors: {
    byRequester: 'Vous avez fait cette demande : elle doit être validée par un autre membre de la finance.',
    notPending: 'Cette demande n’est plus en attente : la liste a été actualisée.',
    notFound: 'Cette demande est introuvable : la liste a été actualisée.',
    topUpNotVerified:
      'Recharge non vérifiée par payment (titulaire, argent reçu ou montant) : rien n’a été crédité.',
  },
  /** Crédit envoyé depuis la fiche d'un portefeuille, au-delà du seuil (`pendingRequest`). */
  pendingFromDialog: (amount: string) =>
    `Crédit de ${amount} au-delà du seuil de double validation : rien n’est crédité tant qu’un autre membre de la finance ne l’a pas validé.`,
  pendingAlready: 'Cette demande de crédit avait déjà été enregistrée : elle attend toujours sa validation.',
  seeRequests: 'Voir les demandes de crédit',
};

export const walletPayoutTexts = {
  ...common,
  title: 'Reversements des titulaires',
  lead: 'Reversements demandés depuis les portefeuilles des créanciers. « En attente de transmission » : pas encore transmis à payment, nouvel essai automatique chaque minute.',
  execution: 'L’exécution des virements se suit dans l’onglet Reversements.',
  executionLink: 'Ouvrir les reversements Mobile Money',
  caption: 'Reversements demandés depuis les portefeuilles',
  empty: 'Aucun reversement demandé pour le moment.',
  emptyFiltered: 'Aucun reversement dans cet état.',
  columns: { beneficiary: 'Bénéficiaire', created: 'Demandé le', progress: 'Suivi' },
  completedOn: (date: string) => `Terminé le ${date}`,
  failedOn: (date: string) => `En échec le ${date}, montant rendu`,
  transmitted: 'Transmis à payment',
};

/** « Ce qui attend une action » : bloc de la vue d'ensemble et sections de « Ma journée ». */
export const pendingTexts = {
  title: 'En attente d’une action',
  loading: 'Lecture des demandes en attente…',
  retry: 'Réessayer',
  nothing: 'Aucun retrait ni demande de crédit en attente.',
  withdrawalsToProcess: (count: string) => `Retraits à traiter : ${count}`,
  withdrawalsToApprove: (count: string) => `Retraits à valider : ${count}`,
  creditRequests: (count: string) => `Demandes de crédit à valider : ${count}`,
  queue: {
    toProcess: {
      title: 'Retraits à traiter',
      description: 'Demandes de retrait vers Mobile Money à vérifier (titulaire, numéro).',
      seeAll: 'Voir tous les retraits à traiter',
    },
    toApprove: {
      title: 'Retraits à valider',
      description: 'Retraits traités qui attendent la validation d’une deuxième personne de la finance.',
      seeAll: 'Voir tous les retraits à valider',
    },
    credits: {
      title: 'Demandes de crédit à valider',
      description:
        'Crédits manuels au-delà du seuil de double validation, à valider par un autre membre que leur auteur.',
      seeAll: 'Voir toutes les demandes de crédit',
    },
    requestedOn: (date: string) => `Demandé le ${date}`,
  },
};
